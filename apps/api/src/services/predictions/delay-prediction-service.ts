import {
  benchmarkCohortMetrics,
  integrations,
  projects,
  risks,
  withTenantContext,
  type Database,
} from '@beacon/db';
import { BENCHMARK_COHORT } from '@beacon/shared/benchmarks';
import { computeDelayPrediction, type DelayPredictionResult } from '@beacon/shared/delay-prediction';
import type { AuthContext } from '@beacon/shared/auth';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { assertProjectAccess } from '../../lib/access.js';
import { env } from '../../env.js';
import { getResolvedFeatureFlags } from '../feature-flags.js';

function parseNumeric(value: string | null | undefined): number | null {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function loadPeerDaysToGoLive(db: Database) {
  const snapshotDate = new Date().toISOString().slice(0, 10);
  const [row] = await db
    .select()
    .from(benchmarkCohortMetrics)
    .where(
      and(
        eq(benchmarkCohortMetrics.snapshotDate, snapshotDate),
        eq(benchmarkCohortMetrics.cohort, BENCHMARK_COHORT),
        eq(benchmarkCohortMetrics.metricKey, 'avg_days_to_go_live'),
      ),
    )
    .limit(1);

  if (row) {
    return {
      p25: parseNumeric(row.p25),
      p50: parseNumeric(row.p50),
      p75: parseNumeric(row.p75),
      cohortSampleTenants: row.sampleTenants,
    };
  }

  const [latest] = await db
    .select()
    .from(benchmarkCohortMetrics)
    .where(
      and(
        eq(benchmarkCohortMetrics.cohort, BENCHMARK_COHORT),
        eq(benchmarkCohortMetrics.metricKey, 'avg_days_to_go_live'),
      ),
    )
    .orderBy(desc(benchmarkCohortMetrics.snapshotDate))
    .limit(1);

  if (!latest) return null;

  return {
    p25: parseNumeric(latest.p25),
    p50: parseNumeric(latest.p50),
    p75: parseNumeric(latest.p75),
    cohortSampleTenants: latest.sampleTenants,
  };
}

export async function getProjectDelayPrediction(
  db: Database,
  tenantId: string,
  auth: AuthContext,
  projectId: string,
): Promise<DelayPredictionResult | null> {
  const flags = await getResolvedFeatureFlags(db, tenantId);

  return withTenantContext(db, tenantId, async () => {
    const [project] = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.tenantId, tenantId), isNull(projects.deletedAt)))
      .limit(1);

    if (!project) return null;
    if (!assertProjectAccess(auth, project)) return null;

    const openRisks = await db
      .select({ score: risks.score })
      .from(risks)
      .where(
        and(
          eq(risks.projectId, projectId),
          eq(risks.tenantId, tenantId),
          inArray(risks.status, ['open', 'acknowledged', 'snoozed']),
          isNull(risks.deletedAt),
        ),
      );

    const integrationRows = await db
      .select({ source: integrations.source, status: integrations.status })
      .from(integrations)
      .where(eq(integrations.tenantId, tenantId));

    const jiraConnected = integrationRows.some(
      (row) => row.source === 'jira' && row.status === 'connected',
    );
    const salesforceConnected = integrationRows.some(
      (row) => row.source === 'salesforce' && row.status === 'connected',
    );
    const calendarConnected = integrationRows.some(
      (row) => row.source === 'google_calendar' && row.status === 'connected',
    );

    const highestRiskScore =
      openRisks.length > 0 ? Math.max(...openRisks.map((row) => row.score)) : null;
    const peerStats = await loadPeerDaysToGoLive(db);

    return computeDelayPrediction({
      targetGoLiveDate: project.targetGoLiveDate,
      projectStatus: project.status,
      highestRiskScore,
      openRiskCount: openRisks.length,
      dataComplete: project.dataComplete,
      jiraConnected,
      salesforceConnected,
      calendarConnected,
      ownerEmail: project.ownerEmail,
      peerDaysToGoLive: peerStats
        ? { p25: peerStats.p25, p50: peerStats.p50, p75: peerStats.p75 }
        : null,
      cohortSampleTenants: peerStats?.cohortSampleTenants ?? 0,
      enabled: env.FEATURE_DELAY_PREDICTIONS_ENABLED && flags.delayPredictionsEnabled,
    });
  });
}
