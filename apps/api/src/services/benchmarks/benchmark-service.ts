import {
  benchmarkCohortMetrics,
  projects,
  risks,
  tenantBenchmarkSnapshots,
  tenants,
  withTenantContext,
  type Database,
} from '@beacon/db';
import {
  BENCHMARK_COHORT,
  BENCHMARK_METRICS,
  buildBenchmarkComparison,
  computePercentiles,
  metricValueFromSnapshot,
  type PortfolioBenchmarkView,
} from '@beacon/shared/benchmarks';
import { mergeFeatureFlags } from '@beacon/shared/feature-flags';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { env } from '../../env.js';
import { getResolvedFeatureFlags } from '../feature-flags.js';

interface TenantBenchmarkMetrics {
  activeProjects: number;
  atRiskProjects: number;
  openRisks: number;
  avgRiskScore: number | null;
  avgDaysToGoLive: number | null;
  atRiskRate: number | null;
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseNumeric(value: string | null | undefined): number | null {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function computeAverageDaysToGoLive(
  projectRows: Array<{ targetGoLiveDate: Date | null }>,
): number | null {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const days = projectRows
    .filter((row) => row.targetGoLiveDate)
    .map((row) => Math.max(0, Math.ceil((row.targetGoLiveDate!.getTime() - now) / dayMs)));
  if (days.length === 0) return null;
  return Math.round(days.reduce((sum, value) => sum + value, 0) / days.length);
}

async function computeTenantBenchmarkMetrics(
  db: Database,
  tenantId: string,
): Promise<TenantBenchmarkMetrics> {
  return withTenantContext(db, tenantId, async () => {
    const projectRows = await db
      .select()
      .from(projects)
      .where(
        and(
          eq(projects.tenantId, tenantId),
          isNull(projects.deletedAt),
          eq(projects.status, 'active'),
        ),
      );

    const openRiskRows = await db
      .select({
        projectId: risks.projectId,
        score: risks.score,
      })
      .from(risks)
      .innerJoin(projects, eq(risks.projectId, projects.id))
      .where(
        and(
          eq(risks.tenantId, tenantId),
          inArray(risks.status, ['open', 'acknowledged', 'snoozed']),
          isNull(risks.deletedAt),
          isNull(projects.deletedAt),
          eq(projects.status, 'active'),
        ),
      );

    const atRiskProjects = new Set(openRiskRows.map((row) => row.projectId)).size;
    const avgRiskScore =
      openRiskRows.length > 0
        ? Math.round(openRiskRows.reduce((sum, row) => sum + row.score, 0) / openRiskRows.length)
        : null;
    const activeProjects = projectRows.length;
    const atRiskRate =
      activeProjects > 0 ? Math.round((atRiskProjects / activeProjects) * 10000) / 10000 : null;

    return {
      activeProjects,
      atRiskProjects,
      openRisks: openRiskRows.length,
      avgRiskScore,
      avgDaysToGoLive: computeAverageDaysToGoLive(projectRows),
      atRiskRate,
    };
  });
}

function serializeSnapshot(row: typeof tenantBenchmarkSnapshots.$inferSelect) {
  return {
    activeProjects: row.activeProjects,
    atRiskProjects: row.atRiskProjects,
    openRisks: row.openRisks,
    avgRiskScore: parseNumeric(row.avgRiskScore),
    avgDaysToGoLive: parseNumeric(row.avgDaysToGoLive),
    atRiskRate: parseNumeric(row.atRiskRate),
  };
}

async function upsertTenantSnapshot(
  db: Database,
  tenantId: string,
  snapshotDate: string,
  metrics: TenantBenchmarkMetrics,
) {
  await withTenantContext(db, tenantId, async () => {
    await db
      .insert(tenantBenchmarkSnapshots)
      .values({
        tenantId,
        snapshotDate,
        activeProjects: metrics.activeProjects,
        atRiskProjects: metrics.atRiskProjects,
        openRisks: metrics.openRisks,
        avgRiskScore: metrics.avgRiskScore?.toString() ?? null,
        avgDaysToGoLive: metrics.avgDaysToGoLive?.toString() ?? null,
        atRiskRate: metrics.atRiskRate?.toString() ?? null,
      })
      .onConflictDoUpdate({
        target: [tenantBenchmarkSnapshots.tenantId, tenantBenchmarkSnapshots.snapshotDate],
        set: {
          activeProjects: metrics.activeProjects,
          atRiskProjects: metrics.atRiskProjects,
          openRisks: metrics.openRisks,
          avgRiskScore: metrics.avgRiskScore?.toString() ?? null,
          avgDaysToGoLive: metrics.avgDaysToGoLive?.toString() ?? null,
          atRiskRate: metrics.atRiskRate?.toString() ?? null,
        },
      });
  });
}

async function listParticipatingTenantIds(db: Database): Promise<string[]> {
  const rows = await db.select({ id: tenants.id, featureFlags: tenants.featureFlags }).from(tenants);
  return rows
    .filter((row) => {
      const flags = mergeFeatureFlags(row.featureFlags as Record<string, unknown>);
      return flags.benchmarkParticipationEnabled;
    })
    .map((row) => row.id);
}

async function recomputeCohortMetrics(db: Database, snapshotDate: string) {
  const tenantIds = await listParticipatingTenantIds(db);
  const snapshots = [];

  for (const tenantId of tenantIds) {
    const row = await withTenantContext(db, tenantId, async () => {
      const [snapshot] = await db
        .select()
        .from(tenantBenchmarkSnapshots)
        .where(
          and(
            eq(tenantBenchmarkSnapshots.tenantId, tenantId),
            eq(tenantBenchmarkSnapshots.snapshotDate, snapshotDate),
          ),
        )
        .limit(1);
      return snapshot ?? null;
    });
    if (row) snapshots.push(row);
  }

  const sampleTenants = snapshots.length;

  for (const definition of BENCHMARK_METRICS) {
    const values = snapshots
      .map((row) => metricValueFromSnapshot(definition.key, serializeSnapshot(row)))
      .filter((value): value is number => value != null);

    const percentiles = computePercentiles(values);

    await db
      .insert(benchmarkCohortMetrics)
      .values({
        snapshotDate,
        cohort: BENCHMARK_COHORT,
        metricKey: definition.key,
        sampleTenants,
        p25: percentiles.p25?.toString() ?? null,
        p50: percentiles.p50?.toString() ?? null,
        p75: percentiles.p75?.toString() ?? null,
      })
      .onConflictDoUpdate({
        target: [
          benchmarkCohortMetrics.snapshotDate,
          benchmarkCohortMetrics.cohort,
          benchmarkCohortMetrics.metricKey,
        ],
        set: {
          sampleTenants,
          p25: percentiles.p25?.toString() ?? null,
          p50: percentiles.p50?.toString() ?? null,
          p75: percentiles.p75?.toString() ?? null,
        },
      });
  }
}

export async function refreshBenchmarkSnapshots(
  db: Database,
  options?: { tenantId?: string; snapshotDate?: string },
) {
  const snapshotDate = options?.snapshotDate ?? todayIsoDate();
  const tenantIds = options?.tenantId
    ? [options.tenantId]
    : await listParticipatingTenantIds(db);

  let refreshedTenants = 0;
  for (const tenantId of tenantIds) {
    const flags = await getResolvedFeatureFlags(db, tenantId);
    if (!flags.benchmarkParticipationEnabled) continue;

    const metrics = await computeTenantBenchmarkMetrics(db, tenantId);
    await upsertTenantSnapshot(db, tenantId, snapshotDate, metrics);
    refreshedTenants += 1;
  }

  await recomputeCohortMetrics(db, snapshotDate);

  return {
    snapshotDate,
    refreshedTenants,
    cohortSampleTenants: refreshedTenants,
  };
}

export async function getPortfolioBenchmark(
  db: Database,
  tenantId: string,
): Promise<PortfolioBenchmarkView> {
  const flags = await getResolvedFeatureFlags(db, tenantId);
  const disabledView: PortfolioBenchmarkView = {
    enabled: env.FEATURE_BENCHMARKS_ENABLED,
    participationEnabled: flags.benchmarkParticipationEnabled,
    snapshotDate: null,
    cohortSampleTenants: 0,
    insufficientData: true,
    metrics: BENCHMARK_METRICS.map((definition) => ({
      key: definition.key,
      label: definition.label,
      direction: definition.direction,
      tenantValue: null,
      p25: null,
      p50: null,
      p75: null,
      position: 'unknown',
      deltaFromMedianPct: null,
    })),
  };

  if (!env.FEATURE_BENCHMARKS_ENABLED || !flags.benchmarkParticipationEnabled) {
    return disabledView;
  }

  const snapshotDate = todayIsoDate();
  let snapshot = await withTenantContext(db, tenantId, async () => {
    const [row] = await db
      .select()
      .from(tenantBenchmarkSnapshots)
      .where(
        and(
          eq(tenantBenchmarkSnapshots.tenantId, tenantId),
          eq(tenantBenchmarkSnapshots.snapshotDate, snapshotDate),
        ),
      )
      .limit(1);
    return row ?? null;
  });

  if (!snapshot) {
    await refreshBenchmarkSnapshots(db, { tenantId, snapshotDate });
    snapshot = await withTenantContext(db, tenantId, async () => {
      const [row] = await db
        .select()
        .from(tenantBenchmarkSnapshots)
        .where(
          and(
            eq(tenantBenchmarkSnapshots.tenantId, tenantId),
            eq(tenantBenchmarkSnapshots.snapshotDate, snapshotDate),
          ),
        )
        .limit(1);
      return row ?? null;
    });
  }

  if (!snapshot) {
    return disabledView;
  }

  const cohortRows = await db
    .select()
    .from(benchmarkCohortMetrics)
    .where(
      and(
        eq(benchmarkCohortMetrics.snapshotDate, snapshotDate),
        eq(benchmarkCohortMetrics.cohort, BENCHMARK_COHORT),
      ),
    );

  const cohortSampleTenants = cohortRows[0]?.sampleTenants ?? 0;
  const view = buildBenchmarkComparison(
    serializeSnapshot(snapshot),
    cohortRows.map((row) => ({
      metricKey: row.metricKey,
      p25: parseNumeric(row.p25),
      p50: parseNumeric(row.p50),
      p75: parseNumeric(row.p75),
    })),
    cohortSampleTenants,
  );

  return {
    ...view,
    enabled: true,
    participationEnabled: true,
    snapshotDate,
  };
}

export async function getBenchmarkAdminStatus(db: Database, tenantId: string) {
  const flags = await getResolvedFeatureFlags(db, tenantId);
  const latestSnapshot = await withTenantContext(db, tenantId, async () => {
    const [row] = await db
      .select()
      .from(tenantBenchmarkSnapshots)
      .where(eq(tenantBenchmarkSnapshots.tenantId, tenantId))
      .orderBy(desc(tenantBenchmarkSnapshots.snapshotDate))
      .limit(1);
    return row ?? null;
  });

  const latestCohort = await db
    .select({ sampleTenants: benchmarkCohortMetrics.sampleTenants })
    .from(benchmarkCohortMetrics)
    .where(eq(benchmarkCohortMetrics.cohort, BENCHMARK_COHORT))
    .orderBy(desc(benchmarkCohortMetrics.snapshotDate))
    .limit(1);

  return {
    enabled: env.FEATURE_BENCHMARKS_ENABLED,
    participationEnabled: flags.benchmarkParticipationEnabled,
    latestSnapshotDate: latestSnapshot?.snapshotDate ?? null,
    cohortSampleTenants: latestCohort[0]?.sampleTenants ?? 0,
  };
}
