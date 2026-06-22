import {
  customers,
  milestones,
  projects,
  risks,
  recommendations,
  integrations,
  integrationMappings,
  events,
  tasks,
  withTenantContext,
  type Database,
} from '@beacon/db';
import { PROJECT_STATUSES, RISK_LEVELS, isProjectCrmDataComplete } from '@beacon/shared';
import type { AuthContext } from '@beacon/shared/auth';
import { hasMinimumRole } from '@beacon/shared/auth';
import { parseListQuery } from '@beacon/shared/api';
import { and, eq, inArray, isNull, sql, gte, lte } from 'drizzle-orm';
import { assertProjectAccess, projectAccessFilter } from '../lib/access.js';
import { invalidateTenantDashboardCache } from '../lib/dashboard-cache.js';
import { getProjectHealthMap } from './dashboard-service.js';
import {
  activeOnly,
  applyCursor,
  orderByCreated,
  paginateQuery,
  serializeRecord,
} from '../lib/query.js';
import { conflict, notFound } from '../lib/errors.js';

const CUSTOMER_SORT = ['created_at', 'name'];
const PROJECT_SORT = ['created_at', 'name', 'target_go_live_date', 'status'];
const RISK_SORT = ['created_at', 'score', 'level'];

export async function listCustomers(
  db: Database,
  tenantId: string,
  auth: AuthContext,
  url: string,
) {
  const query = parseListQuery(new URL(url).searchParams, CUSTOMER_SORT);
  const limit = query.limit + 1;

  return withTenantContext(db, tenantId, async () => {
    const accessFilter = projectAccessFilter(auth, projects.ownerEmail);
    let allowedCustomerIds: string[] | null = null;

    if (accessFilter) {
      const accessibleProjects = await db
        .select({ customerId: projects.customerId })
        .from(projects)
        .where(
          and(
            eq(projects.tenantId, tenantId),
            isNull(projects.deletedAt),
            accessFilter,
          ),
        );
      allowedCustomerIds = [...new Set(accessibleProjects.map((row) => row.customerId))];
      if (allowedCustomerIds.length === 0) {
        return paginateQuery([], query.limit);
      }
    }

    const rows = await db
      .select()
      .from(customers)
      .where(
        and(
          eq(customers.tenantId, tenantId),
          activeOnly(customers, query.includeDeleted),
          allowedCustomerIds ? inArray(customers.id, allowedCustomerIds) : undefined,
          applyCursor(customers, query.cursor, query.sortDirection),
        ),
      )
      .orderBy(...orderByCreated(customers, query.sortDirection))
      .limit(limit);

    return paginateQuery(rows.map(serializeRecord), query.limit);
  });
}

export async function getCustomer(
  db: Database,
  tenantId: string,
  auth: AuthContext,
  customerId: string,
) {
  return withTenantContext(db, tenantId, async () => {
    const [row] = await db
      .select()
      .from(customers)
      .where(
        and(
          eq(customers.id, customerId),
          eq(customers.tenantId, tenantId),
          isNull(customers.deletedAt),
        ),
      )
      .limit(1);

    if (!row) throw notFound('Customer not found');

    if (!hasMinimumRole(auth.role, 'operational')) {
      const [accessibleProject] = await db
        .select({ id: projects.id })
        .from(projects)
        .where(
          and(
            eq(projects.tenantId, tenantId),
            eq(projects.customerId, customerId),
            isNull(projects.deletedAt),
            projectAccessFilter(auth, projects.ownerEmail),
          ),
        )
        .limit(1);
      if (!accessibleProject) throw notFound('Customer not found');
    }

    return serializeRecord(row);
  });
}

export async function createCustomer(
  db: Database,
  tenantId: string,
  input: {
    name: string;
    externalId: string;
    externalSource?: 'salesforce' | 'jira' | 'slack' | 'google_calendar';
  },
) {
  return withTenantContext(db, tenantId, async () => {
    try {
      const [row] = await db
        .insert(customers)
        .values({
          tenantId,
          name: input.name,
          externalId: input.externalId,
          externalSource: input.externalSource ?? 'salesforce',
        })
        .returning();
      return serializeRecord(row!);
    } catch {
      throw conflict('Customer with this external ID already exists');
    }
  });
}

export async function listProjects(
  db: Database,
  tenantId: string,
  auth: AuthContext,
  url: string,
) {
  const query = parseListQuery(new URL(url).searchParams, PROJECT_SORT);
  const limit = query.limit + 1;
  const statusParam = new URL(url).searchParams.get('status');
  const portfolioActive = new URL(url).searchParams.get('portfolio') === 'active';
  const ownerFilter = new URL(url).searchParams.get('owner');
  const riskLevelFilter = new URL(url).searchParams.get('risk_level');
  const includeHealth = new URL(url).searchParams.get('include_health') !== 'false';
  const status =
    statusParam && PROJECT_STATUSES.includes(statusParam as (typeof PROJECT_STATUSES)[number])
      ? (statusParam as (typeof PROJECT_STATUSES)[number])
      : null;

  return withTenantContext(db, tenantId, async () => {
    const accessFilter = projectAccessFilter(auth, projects.ownerEmail);
    const rows = await db
      .select()
      .from(projects)
      .where(
        and(
          eq(projects.tenantId, tenantId),
          activeOnly(projects, query.includeDeleted),
          status ? eq(projects.status, status) : undefined,
          portfolioActive
            ? sql`${projects.status} NOT IN ('on_hold', 'completed', 'cancelled')`
            : undefined,
          ownerFilter ? sql`lower(${projects.ownerEmail}) = ${ownerFilter.toLowerCase()}` : undefined,
          accessFilter,
          applyCursor(projects, query.cursor, query.sortDirection),
        ),
      )
      .orderBy(...orderByCreated(projects, query.sortDirection))
      .limit(limit);

    let serialized: Array<ReturnType<typeof serializeRecord> & { healthSummary?: unknown }> =
      rows.map(serializeRecord);

    if (includeHealth && serialized.length > 0) {
      const healthMap = await getProjectHealthMap(
        db,
        tenantId,
        serialized.map((row) => String(row.id)),
      );
      serialized = serialized.map((row) => ({
        ...row,
        healthSummary: healthMap.get(String(row.id)) ?? {
          openRiskCount: 0,
          highestRiskLevel: null,
          highestRiskScore: null,
        },
      }));
    }

    if (
      riskLevelFilter &&
      RISK_LEVELS.includes(riskLevelFilter as (typeof RISK_LEVELS)[number])
    ) {
      serialized = serialized.filter(
        (row) =>
          (row.healthSummary as { highestRiskLevel?: string | null } | undefined)
            ?.highestRiskLevel === riskLevelFilter,
      );
    }

    return paginateQuery(
      serialized as Array<{ id: string; createdAt: Date | string } & Record<string, unknown>>,
      query.limit,
    );
  });
}

export async function getProject(
  db: Database,
  tenantId: string,
  auth: AuthContext,
  projectId: string,
) {
  return withTenantContext(db, tenantId, async () => {
    const [row] = await db
      .select()
      .from(projects)
      .where(
        and(eq(projects.id, projectId), eq(projects.tenantId, tenantId), isNull(projects.deletedAt)),
      )
      .limit(1);

    if (!row) throw notFound('Project not found');
    if (!assertProjectAccess(auth, row)) {
      throw notFound('Project not found');
    }
    return serializeRecord(row);
  });
}

export async function createProject(
  db: Database,
  tenantId: string,
  input: {
    customerId: string;
    name: string;
    status?: 'active' | 'on_hold' | 'completed' | 'cancelled';
    targetGoLiveDate?: string | null;
    arrAmount?: number | null;
    arrCurrency?: string | null;
    ownerName?: string | null;
    ownerEmail?: string | null;
    externalId?: string | null;
    externalSource?: 'salesforce' | 'jira' | 'slack' | 'google_calendar' | null;
  },
) {
  return withTenantContext(db, tenantId, async () => {
    const [customer] = await db
      .select()
      .from(customers)
      .where(
        and(
          eq(customers.id, input.customerId),
          eq(customers.tenantId, tenantId),
          isNull(customers.deletedAt),
        ),
      )
      .limit(1);

    if (!customer) throw notFound('Customer not found');

    const [row] = await db
      .insert(projects)
      .values({
        tenantId,
        customerId: input.customerId,
        name: input.name,
        status: input.status ?? 'active',
        targetGoLiveDate: input.targetGoLiveDate ? new Date(input.targetGoLiveDate) : null,
        arrAmount: input.arrAmount ?? null,
        arrCurrency: input.arrCurrency ?? 'USD',
        ownerName: input.ownerName ?? null,
        ownerEmail: input.ownerEmail ?? null,
        externalId: input.externalId ?? null,
        externalSource: input.externalSource ?? null,
        dataComplete: isProjectCrmDataComplete({
          targetGoLiveDate: input.targetGoLiveDate,
          arrAmount: input.arrAmount,
        }),
      })
      .returning();

    return serializeRecord(row!);
  });
}

export async function softDeleteProject(db: Database, tenantId: string, projectId: string) {
  return withTenantContext(db, tenantId, async () => {
    const [row] = await db
      .update(projects)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(projects.id, projectId), eq(projects.tenantId, tenantId), isNull(projects.deletedAt)))
      .returning();

    if (!row) throw notFound('Project not found');
    return serializeRecord(row);
  });
}

export async function listRisks(db: Database, tenantId: string, auth: AuthContext, url: string) {
  const query = parseListQuery(new URL(url).searchParams, RISK_SORT);
  const limit = query.limit + 1;
  const urlObj = new URL(url);
  const level = urlObj.searchParams.get('level');
  const status = urlObj.searchParams.get('status');
  const ownerFilter = urlObj.searchParams.get('owner');
  const createdAfter = urlObj.searchParams.get('created_after');
  const createdBefore = urlObj.searchParams.get('created_before');
  const activeOnlyParam = urlObj.searchParams.get('active_only');

  const statusFilter =
    status != null
      ? eq(risks.status, status as typeof risks.status.enumValues[number])
      : activeOnlyParam !== 'false'
        ? inArray(risks.status, ['open', 'acknowledged', 'snoozed'])
        : undefined;

  return withTenantContext(db, tenantId, async () => {
    const rows = await db
      .select({
        risk: risks,
        project: projects,
        customer: customers,
        suggestedAction: sql<string | null>`(
          SELECT ${recommendations.suggestedAction}
          FROM ${recommendations}
          WHERE ${recommendations.riskId} = ${risks.id}
            AND ${recommendations.status} = 'pending'
          LIMIT 1
        )`.as('suggested_action'),
      })
      .from(risks)
      .innerJoin(projects, eq(risks.projectId, projects.id))
      .innerJoin(customers, eq(projects.customerId, customers.id))
      .where(
        and(
          eq(risks.tenantId, tenantId),
          activeOnly(risks, query.includeDeleted),
          level ? eq(risks.level, level as typeof risks.level.enumValues[number]) : undefined,
          statusFilter,
          ownerFilter
            ? sql`lower(${projects.ownerEmail}) = ${ownerFilter.toLowerCase()}`
            : undefined,
          createdAfter ? gte(risks.createdAt, new Date(createdAfter)) : undefined,
          createdBefore ? lte(risks.createdAt, new Date(createdBefore)) : undefined,
          projectAccessFilter(auth, projects.ownerEmail),
          applyCursor(risks, query.cursor, query.sortDirection),
        ),
      )
      .orderBy(...orderByCreated(risks, query.sortDirection))
      .limit(limit);

    return paginateQuery(
      rows.map(({ risk, project, customer, suggestedAction }) =>
        serializeRecord({
          ...risk,
          projectName: project.name,
          customerName: customer.name,
          ownerEmail: project.ownerEmail,
          arrAmount: project.arrAmount,
          arrCurrency: project.arrCurrency,
          suggestedAction,
        }),
      ),
      query.limit,
    );
  });
}

export async function getRisk(db: Database, tenantId: string, auth: AuthContext, riskId: string) {
  return withTenantContext(db, tenantId, async () => {
    const [row] = await db
      .select({ risk: risks, project: projects })
      .from(risks)
      .innerJoin(projects, eq(risks.projectId, projects.id))
      .where(and(eq(risks.id, riskId), eq(risks.tenantId, tenantId), isNull(risks.deletedAt)))
      .limit(1);

    if (!row || !assertProjectAccess(auth, row.project)) {
      throw notFound('Risk not found');
    }

    return serializeRecord({ ...row.risk, projectName: row.project.name });
  });
}

export async function patchRiskStatus(
  db: Database,
  tenantId: string,
  auth: AuthContext,
  riskId: string,
  status: 'open' | 'acknowledged' | 'resolved' | 'snoozed',
  snoozedUntil?: string | null,
  feedback?: string,
  expectedVersion?: number,
) {
  return withTenantContext(db, tenantId, async () => {
    const [existing] = await db
      .select({ risk: risks, project: projects })
      .from(risks)
      .innerJoin(projects, eq(risks.projectId, projects.id))
      .where(and(eq(risks.id, riskId), eq(risks.tenantId, tenantId), isNull(risks.deletedAt)))
      .limit(1);

    if (!existing || !assertProjectAccess(auth, existing.project)) {
      throw notFound('Risk not found');
    }
    if (expectedVersion != null && existing.risk.version !== expectedVersion) {
      throw conflict('Risk was updated concurrently. Refresh and retry.');
    }

    const [row] = await db
      .update(risks)
      .set({
        status,
        snoozedUntil: snoozedUntil ? new Date(snoozedUntil) : null,
        acknowledgedAt: status === 'acknowledged' ? new Date() : undefined,
        acknowledgedFeedback: status === 'acknowledged' ? feedback ?? null : undefined,
        resolvedAt: status === 'resolved' ? new Date() : undefined,
        version: existing.risk.version + 1,
        updatedAt: new Date(),
      })
      .where(and(eq(risks.id, riskId), eq(risks.tenantId, tenantId), isNull(risks.deletedAt)))
      .returning();

    if (!row) throw notFound('Risk not found');
    await invalidateTenantDashboardCache(tenantId);
    return serializeRecord(row);
  });
}

export async function listIntegrations(db: Database, tenantId: string) {
  return withTenantContext(db, tenantId, async () => {
    const rows = await db
      .select({
        id: integrations.id,
        source: integrations.source,
        status: integrations.status,
        lastSyncAt: integrations.lastSyncAt,
        lastError: integrations.lastError,
        createdAt: integrations.createdAt,
        updatedAt: integrations.updatedAt,
      })
      .from(integrations)
      .where(eq(integrations.tenantId, tenantId));

    return { data: rows.map(serializeRecord) };
  });
}

export async function getProjectTimeline(
  db: Database,
  tenantId: string,
  projectId: string,
  url?: string,
) {
  const sinceParam = url ? new URL(url).searchParams.get('since') : null;
  const limitParam = url ? new URL(url).searchParams.get('limit') : null;
  const limit = limitParam ? Math.min(500, Math.max(1, Number(limitParam) || 100)) : 100;

  let sinceDate: Date | undefined;
  if (sinceParam?.endsWith('d')) {
    const days = Number.parseInt(sinceParam.slice(0, -1), 10);
    if (Number.isFinite(days) && days > 0) {
      sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    }
  } else if (sinceParam) {
    const parsed = new Date(sinceParam);
    if (!Number.isNaN(parsed.getTime())) sinceDate = parsed;
  }

  return withTenantContext(db, tenantId, async () => {
    const timeline = await db
      .select()
      .from(events)
      .where(
        and(
          eq(events.tenantId, tenantId),
          eq(events.projectId, projectId),
          sinceDate ? gte(events.occurredAt, sinceDate) : undefined,
        ),
      )
      .orderBy(sql`${events.occurredAt} desc`)
      .limit(limit);

    return { data: timeline.map(serializeRecord) };
  });
}

export async function listProjectMilestones(db: Database, tenantId: string, projectId: string) {
  return withTenantContext(db, tenantId, async () => {
    const rows = await db
      .select()
      .from(milestones)
      .where(
        and(
          eq(milestones.tenantId, tenantId),
          eq(milestones.projectId, projectId),
          isNull(milestones.deletedAt),
        ),
      )
      .orderBy(sql`${milestones.createdAt} desc`);

    return { data: rows.map(serializeRecord) };
  });
}

export async function listProjectTasks(db: Database, tenantId: string, projectId: string) {
  return withTenantContext(db, tenantId, async () => {
    const rows = await db
      .select()
      .from(tasks)
      .where(
        and(eq(tasks.tenantId, tenantId), eq(tasks.projectId, projectId), isNull(tasks.deletedAt)),
      )
      .orderBy(sql`${tasks.createdAt} desc`);

    return { data: rows.map(serializeRecord) };
  });
}

export async function listProjectRecommendations(
  db: Database,
  tenantId: string,
  projectId: string,
) {
  return withTenantContext(db, tenantId, async () => {
    const rows = await db
      .select()
      .from(recommendations)
      .where(
        and(
          eq(recommendations.tenantId, tenantId),
          eq(recommendations.projectId, projectId),
          isNull(recommendations.deletedAt),
        ),
      )
      .orderBy(sql`${recommendations.createdAt} desc`);

    return { data: rows.map(serializeRecord) };
  });
}

export async function listIntegrationMappings(db: Database, tenantId: string, integrationId: string) {
  return withTenantContext(db, tenantId, async () => {
    const rows = await db
      .select()
      .from(integrationMappings)
      .where(
        and(
          eq(integrationMappings.tenantId, tenantId),
          eq(integrationMappings.integrationId, integrationId),
          isNull(integrationMappings.deletedAt),
        ),
      );

    return { data: rows.map(serializeRecord) };
  });
}

export async function createIntegrationMapping(
  db: Database,
  tenantId: string,
  input: {
    integrationId: string;
    mappingType: 'project_to_jira' | 'project_to_slack_channel' | 'salesforce_field' | 'customer_to_account';
    internalId: string;
    externalId: string;
    metadata?: Record<string, unknown>;
  },
) {
  return withTenantContext(db, tenantId, async () => {
    try {
      const [row] = await db
        .insert(integrationMappings)
        .values({
          tenantId,
          integrationId: input.integrationId,
          mappingType: input.mappingType,
          internalId: input.internalId,
          externalId: input.externalId,
          metadata: input.metadata ?? {},
        })
        .returning();
      return serializeRecord(row!);
    } catch {
      throw conflict('Integration mapping already exists');
    }
  });
}

export async function getRevenueImpact(db: Database, tenantId: string, auth: AuthContext) {
  const { getRevenueImpactSummary } = await import('./dashboard-service.js');
  return getRevenueImpactSummary(db, tenantId, auth);
}
