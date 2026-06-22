import { customers, projects, recommendations, risks, integrationMappings, withTenantContext, type Database } from '@beacon/db';
import type { AuthContext } from '@beacon/shared/auth';
import { computePortfolioArrTotals, type CurrencyBreakdownEntry } from '@beacon/shared';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { projectAccessFilter } from '../lib/access.js';
import { assertProjectAccess } from '../lib/access.js';
import {
  buildDashboardScopeKey,
  dashboardCacheKey,
  DASHBOARD_CACHE_TTL_SECONDS,
  getCachedJson,
  setCachedJson,
} from '../lib/dashboard-cache.js';
import { serializeRecord } from '../lib/query.js';

export interface DashboardSummary {
  activeProjects: number;
  atRiskProjects: number;
  totalDelayedArr: number | null;
  currency: string | null;
  multiCurrency: boolean;
  currencyBreakdown: CurrencyBreakdownEntry[];
  averageRiskScore: number | null;
  averageConfidence: number | null;
  averageDaysToGoLive: number | null;
  trendStatus: 'insufficient_history' | 'stable' | 'improving' | 'worsening';
  trendLabel: string;
  projectsWithUnknownArr: number;
  openRiskCount: number;
  lastUpdated: string;
  cached: boolean;
}

export interface RevenueImpactSummary {
  totalDelayedArr: number | null;
  currency: string | null;
  multiCurrency: boolean;
  currencyBreakdown: CurrencyBreakdownEntry[];
  activeProjects: number;
  atRiskProjects: number;
  projectsWithUnknownArr: number;
  projects: Array<{
    projectId: string;
    projectName: string;
    arrAmount: number | null;
    arrCurrency: string | null;
    openRiskCount: number;
    highestRiskLevel: string | null;
    highestRiskScore: number | null;
  }>;
  lastUpdated: string;
  cached: boolean;
}

const LEVEL_RANK: Record<string, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

function highestLevel(levels: string[]): string | null {
  if (levels.length === 0) return null;
  return levels.reduce((best, current) =>
    (LEVEL_RANK[current] ?? 0) > (LEVEL_RANK[best] ?? 0) ? current : best,
  );
}

async function loadAccessibleProjects(db: Database, tenantId: string, auth: AuthContext) {
  return withTenantContext(db, tenantId, async () =>
    db
      .select()
      .from(projects)
      .where(
        and(
          eq(projects.tenantId, tenantId),
          isNull(projects.deletedAt),
          eq(projects.status, 'active'),
          projectAccessFilter(auth, projects.ownerEmail),
        ),
      ),
  );
}

async function loadOpenRisks(db: Database, tenantId: string, auth: AuthContext) {
  return withTenantContext(db, tenantId, async () =>
    db
      .select({
        risk: risks,
        project: projects,
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
          projectAccessFilter(auth, projects.ownerEmail),
        ),
      ),
  );
}

function dedupeProjectsByRisk(
  openRisks: Array<{
    risk: typeof risks.$inferSelect;
    project: typeof projects.$inferSelect;
  }>,
) {
  const byProject = new Map<
    string,
    {
      projectId: string;
      projectName: string;
      arrAmount: number | null;
      arrCurrency: string | null;
      openRiskCount: number;
      highestRiskLevel: string | null;
      highestRiskScore: number | null;
      confidenceTotal: number;
    }
  >();

  for (const row of openRisks) {
    const existing = byProject.get(row.project.id);
    if (!existing) {
      byProject.set(row.project.id, {
        projectId: row.project.id,
        projectName: row.project.name,
        arrAmount: row.project.arrAmount,
        arrCurrency: row.project.arrCurrency,
        openRiskCount: 1,
        highestRiskLevel: row.risk.level,
        highestRiskScore: row.risk.score,
        confidenceTotal: row.risk.confidence,
      });
      continue;
    }

    existing.openRiskCount += 1;
    existing.confidenceTotal += row.risk.confidence;
    if ((row.risk.score ?? 0) > (existing.highestRiskScore ?? 0)) {
      existing.highestRiskScore = row.risk.score;
      existing.highestRiskLevel = row.risk.level;
    } else if (existing.highestRiskLevel) {
      existing.highestRiskLevel = highestLevel([existing.highestRiskLevel, row.risk.level])!;
    }
  }

  return byProject;
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

function computeTrendStatus(
  projectRows: Array<{ createdAt: Date }>,
): Pick<DashboardSummary, 'trendStatus' | 'trendLabel'> {
  if (projectRows.length === 0) {
    return { trendStatus: 'insufficient_history', trendLabel: 'Insufficient history' };
  }
  const oldest = projectRows.reduce(
    (min, row) => (row.createdAt < min ? row.createdAt : min),
    projectRows[0]!.createdAt,
  );
  const historyDays = (Date.now() - oldest.getTime()) / (24 * 60 * 60 * 1000);
  if (historyDays < 7) {
    return { trendStatus: 'insufficient_history', trendLabel: 'Insufficient history' };
  }
  return { trendStatus: 'stable', trendLabel: 'Stable' };
}

export async function getDashboardSummary(
  db: Database,
  tenantId: string,
  auth: AuthContext,
): Promise<DashboardSummary> {
  const cacheKey = dashboardCacheKey(tenantId, buildDashboardScopeKey(auth));
  const cached = await getCachedJson<DashboardSummary>(cacheKey);
  if (cached) return { ...cached, cached: true };

  const [projectRows, openRiskRows] = await Promise.all([
    loadAccessibleProjects(db, tenantId, auth),
    loadOpenRisks(db, tenantId, auth),
  ]);

  const deduped = dedupeProjectsByRisk(openRiskRows);
  const arrTotals = computePortfolioArrTotals([...deduped.values()]);
  const projectsWithUnknownArr = projectRows.filter((row) => row.arrAmount == null).length;
  const averageRiskScore =
    openRiskRows.length > 0
      ? Math.round(openRiskRows.reduce((sum, row) => sum + row.risk.score, 0) / openRiskRows.length)
      : null;
  const averageConfidence =
    openRiskRows.length > 0
      ? Math.round(
          openRiskRows.reduce((sum, row) => sum + row.risk.confidence, 0) / openRiskRows.length,
        )
      : null;
  const trend = computeTrendStatus(projectRows);

  const summary: DashboardSummary = {
    activeProjects: projectRows.length,
    atRiskProjects: deduped.size,
    totalDelayedArr: arrTotals.totalDelayedArr,
    currency: arrTotals.currency,
    multiCurrency: arrTotals.multiCurrency,
    currencyBreakdown: arrTotals.currencyBreakdown,
    averageRiskScore,
    averageConfidence,
    averageDaysToGoLive: computeAverageDaysToGoLive(projectRows),
    trendStatus: trend.trendStatus,
    trendLabel: trend.trendLabel,
    projectsWithUnknownArr,
    openRiskCount: openRiskRows.length,
    lastUpdated: new Date().toISOString(),
    cached: false,
  };

  await setCachedJson(cacheKey, summary, DASHBOARD_CACHE_TTL_SECONDS);
  return summary;
}

export async function getRevenueImpactSummary(
  db: Database,
  tenantId: string,
  auth: AuthContext,
): Promise<RevenueImpactSummary> {
  const cacheKey = dashboardCacheKey(tenantId, `${buildDashboardScopeKey(auth)}:revenue`);
  const cached = await getCachedJson<RevenueImpactSummary>(cacheKey);
  if (cached) return { ...cached, cached: true };

  const [projectRows, openRiskRows] = await Promise.all([
    loadAccessibleProjects(db, tenantId, auth),
    loadOpenRisks(db, tenantId, auth),
  ]);

  const deduped = dedupeProjectsByRisk(openRiskRows);
  const projects = [...deduped.values()].map((row) => serializeRecord(row));
  const arrTotals = computePortfolioArrTotals([...deduped.values()]);

  const summary: RevenueImpactSummary = {
    totalDelayedArr: arrTotals.totalDelayedArr,
    currency: arrTotals.currency,
    multiCurrency: arrTotals.multiCurrency,
    currencyBreakdown: arrTotals.currencyBreakdown,
    activeProjects: projectRows.length,
    atRiskProjects: deduped.size,
    projectsWithUnknownArr: projectRows.filter((row) => row.arrAmount == null).length,
    projects,
    lastUpdated: new Date().toISOString(),
    cached: false,
  };

  await setCachedJson(cacheKey, summary, DASHBOARD_CACHE_TTL_SECONDS);
  return summary;
}

export async function getProjectHealthMap(
  db: Database,
  tenantId: string,
  projectIds: string[],
): Promise<
  Map<
    string,
    { openRiskCount: number; highestRiskLevel: string | null; highestRiskScore: number | null }
  >
> {
  if (projectIds.length === 0) return new Map();

  const rows = await withTenantContext(db, tenantId, async () =>
    db
      .select()
      .from(risks)
      .where(
        and(
          eq(risks.tenantId, tenantId),
          inArray(risks.projectId, projectIds),
          inArray(risks.status, ['open', 'acknowledged', 'snoozed']),
          isNull(risks.deletedAt),
        ),
      ),
  );

  const map = new Map<
    string,
    { openRiskCount: number; highestRiskLevel: string | null; highestRiskScore: number | null }
  >();

  for (const row of rows) {
    const existing = map.get(row.projectId);
    if (!existing) {
      map.set(row.projectId, {
        openRiskCount: 1,
        highestRiskLevel: row.level,
        highestRiskScore: row.score,
      });
      continue;
    }
    existing.openRiskCount += 1;
    if (row.score > (existing.highestRiskScore ?? 0)) {
      existing.highestRiskScore = row.score;
      existing.highestRiskLevel = row.level;
    } else if (existing.highestRiskLevel) {
      existing.highestRiskLevel = highestLevel([existing.highestRiskLevel, row.level]);
    }
  }

  return map;
}

export async function getProjectDetail(
  db: Database,
  tenantId: string,
  auth: AuthContext,
  projectId: string,
) {
  return withTenantContext(db, tenantId, async () => {
    const [project] = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.tenantId, tenantId), isNull(projects.deletedAt)))
      .limit(1);

    if (!project) return null;
    if (!assertProjectAccess(auth, project)) return null;

    const [customer] = await db
      .select()
      .from(customers)
      .where(eq(customers.id, project.customerId))
      .limit(1);

    const openRisks = await db
      .select()
      .from(risks)
      .where(
        and(
          eq(risks.projectId, projectId),
          eq(risks.tenantId, tenantId),
          inArray(risks.status, ['open', 'acknowledged', 'snoozed']),
          isNull(risks.deletedAt),
        ),
      )
      .orderBy(sql`${risks.score} desc`);

    const recRows = await db
      .select()
      .from(recommendations)
      .where(
        and(
          eq(recommendations.tenantId, tenantId),
          eq(recommendations.projectId, projectId),
          isNull(recommendations.deletedAt),
        ),
      );

    const recommendationByRisk = new Map(recRows.map((row) => [row.riskId, row]));

    const [jiraMapping] = await db
      .select({ id: integrationMappings.id })
      .from(integrationMappings)
      .where(
        and(
          eq(integrationMappings.tenantId, tenantId),
          eq(integrationMappings.internalId, projectId),
          eq(integrationMappings.mappingType, 'project_to_jira'),
          isNull(integrationMappings.deletedAt),
        ),
      )
      .limit(1);

    const health = {
      openRiskCount: openRisks.length,
      highestRiskLevel: openRisks[0]?.level ?? null,
      highestRiskScore: openRisks[0]?.score ?? null,
      averageConfidence:
        openRisks.length > 0
          ? Math.round(openRisks.reduce((sum, row) => sum + row.confidence, 0) / openRisks.length)
          : null,
    };

    return {
      project: serializeRecord(project),
      customer: customer ? serializeRecord(customer) : null,
      health,
      setupIncomplete: !project.dataComplete,
      jiraLinked: Boolean(jiraMapping),
      openRisks: openRisks.map((risk) => {
        const recommendation = recommendationByRisk.get(risk.id);
        return serializeRecord({
          ...risk,
          suggestedAction: recommendation?.suggestedAction ?? null,
          suggestedOwner: recommendation?.suggestedOwner ?? null,
          escalationPath: recommendation?.escalationPath ?? null,
        });
      }),
    };
  });
}

export function rowsToCsv(headers: string[], rows: Array<Record<string, unknown>>): string {
  const escape = (value: unknown) => {
    const text = value == null ? '' : String(value);
    if (text.includes(',') || text.includes('"') || text.includes('\n')) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((header) => escape(row[header])).join(','));
  }
  return `${lines.join('\n')}\n`;
}
