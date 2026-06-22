import { createDb } from '@beacon/db';
import { PROJECT_STATUSES, RISK_LEVELS, RISK_STATUSES } from '@beacon/shared';
import type { Context } from 'hono';
import { Hono } from 'hono';
import { z } from 'zod';
import { env } from '../../env.js';
import { ApiError, badRequest, notFound, problemResponse } from '../../lib/errors.js';
import { withIdempotency } from '../../lib/idempotency.js';
import { getAuth, requireAuth } from '../../middleware/auth.js';
import { assertProjectAccess } from '../../lib/access.js';
import { requireRole } from '../../middleware/rbac.js';
import { auditContextFromRequest, recordAuditEvent } from '../../services/audit/audit-service.js';
import type { AuditAction } from '@beacon/shared/audit';
import {
  createCustomer,
  createIntegrationMapping,
  createProject,
  getCustomer,
  getProject,
  getProjectTimeline,
  getRevenueImpact,
  getRisk,
  listCustomers,
  listIntegrationMappings,
  listIntegrations,
  listProjectMilestones,
  listProjectRecommendations,
  listProjectTasks,
  listProjects,
  listRisks,
  patchRiskStatus,
  softDeleteProject,
} from '../../services/operational-service.js';
import { getProjectDetail, rowsToCsv } from '../../services/dashboard-service.js';
import { getIntegrationCatalog } from '../../services/integration-catalog-service.js';

function requireParam(c: Context, key: string): string {
  const value = c.req.param(key);
  if (!value) throw badRequest(`Missing route parameter: ${key}`);
  return value;
}

const createCustomerSchema = z.object({
  name: z.string().min(1).max(200),
  externalId: z.string().min(1).max(200),
  externalSource: z.enum(['salesforce', 'jira', 'slack', 'google_calendar']).optional(),
});

const createProjectSchema = z.object({
  customerId: z.string().uuid(),
  name: z.string().min(1).max(200),
  status: z.enum(PROJECT_STATUSES).optional(),
  targetGoLiveDate: z.string().datetime().nullable().optional(),
  arrAmount: z.number().int().nullable().optional(),
  arrCurrency: z.string().length(3).optional(),
  ownerName: z.string().nullable().optional(),
  ownerEmail: z.string().email().nullable().optional(),
  externalId: z.string().nullable().optional(),
  externalSource: z.enum(['salesforce', 'jira', 'slack', 'google_calendar']).nullable().optional(),
});

const patchRiskSchema = z.object({
  status: z.enum(RISK_STATUSES),
  snoozedUntil: z.string().datetime().nullable().optional(),
  feedback: z.string().max(500).optional(),
  version: z.number().int().min(1).optional(),
});

const createMappingSchema = z.object({
  integrationId: z.string().uuid(),
  mappingType: z.enum([
    'project_to_jira',
    'project_to_slack_channel',
    'salesforce_field',
    'customer_to_account',
  ]),
  internalId: z.string().uuid(),
  externalId: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
});

export const operationalRoutes = new Hono();

operationalRoutes.get('/customers', requireAuth, async (c) => {
  try {
    const auth = getAuth(c);
    const { db } = createDb(env.DATABASE_URL);
    const result = await listCustomers(db, auth.tenantId, auth, c.req.url);
    return c.json(result);
  } catch (error) {
    if (error instanceof ApiError) return problemResponse(c, error);
    throw error;
  }
});

operationalRoutes.get('/customers/:customerId', requireAuth, async (c) => {
  try {
    const auth = getAuth(c);
    const { db } = createDb(env.DATABASE_URL);
    const customer = await getCustomer(db, auth.tenantId, auth, requireParam(c, 'customerId'));
    return c.json({ customer });
  } catch (error) {
    if (error instanceof ApiError) return problemResponse(c, error);
    throw error;
  }
});

operationalRoutes.post('/customers', requireAuth, requireRole('operational'), async (c) => {
  const auth = getAuth(c);
  const body = createCustomerSchema.safeParse(await c.req.json());
  if (!body.success) return problemResponse(c, badRequest(body.error.message));

  const { db } = createDb(env.DATABASE_URL);
  return withIdempotency(c, db, auth.tenantId, async () => {
    const customer = await createCustomer(db, auth.tenantId, body.data);
    return { status: 201, body: { customer } };
  });
});

operationalRoutes.get('/projects', requireAuth, async (c) => {
  try {
    const auth = getAuth(c);
    const { db } = createDb(env.DATABASE_URL);
    const result = await listProjects(db, auth.tenantId, auth, c.req.url);
    if (new URL(c.req.url).searchParams.get('format') === 'csv') {
      const rows = result.data.map((row) => {
        const project = row as Record<string, unknown> & {
          healthSummary?: { openRiskCount?: number };
        };
        return {
          id: project.id,
          name: project.name,
          status: project.status,
          ownerEmail: project.ownerEmail,
          arrAmount: project.arrAmount,
          openRiskCount: project.healthSummary?.openRiskCount ?? 0,
        };
      });
      c.header('Content-Type', 'text/csv; charset=utf-8');
      return c.body(rowsToCsv(['id', 'name', 'status', 'ownerEmail', 'arrAmount', 'openRiskCount'], rows));
    }
    return c.json(result);
  } catch (error) {
    if (error instanceof ApiError) return problemResponse(c, error);
    throw error;
  }
});

operationalRoutes.get('/projects/:projectId', requireAuth, async (c) => {
  try {
    const auth = getAuth(c);
    const { db } = createDb(env.DATABASE_URL);
    const projectId = requireParam(c, 'projectId');
    const detail = new URL(c.req.url).searchParams.get('detail');
    if (detail === 'full' || detail === 'true') {
      const full = await getProjectDetail(db, auth.tenantId, auth, projectId);
      if (!full || !assertProjectAccess(auth, { ownerEmail: full.project.ownerEmail as string | null })) {
        return problemResponse(c, notFound('Project not found'));
      }
      return c.json(full);
    }
    const project = await getProject(db, auth.tenantId, auth, projectId);
    return c.json({ project });
  } catch (error) {
    if (error instanceof ApiError) return problemResponse(c, error);
    throw error;
  }
});

operationalRoutes.post('/projects', requireAuth, requireRole('operational'), async (c) => {
  const auth = getAuth(c);
  const body = createProjectSchema.safeParse(await c.req.json());
  if (!body.success) return problemResponse(c, badRequest(body.error.message));

  const { db } = createDb(env.DATABASE_URL);
  return withIdempotency(c, db, auth.tenantId, async () => {
    const project = await createProject(db, auth.tenantId, body.data);
    return { status: 201, body: { project } };
  });
});

operationalRoutes.delete(
  '/projects/:projectId',
  requireAuth,
  requireRole('operational'),
  async (c) => {
    try {
      const auth = getAuth(c);
      const { db } = createDb(env.DATABASE_URL);
      await softDeleteProject(db, auth.tenantId, requireParam(c, 'projectId'));
      return c.body(null, 204);
    } catch (error) {
      if (error instanceof ApiError) return problemResponse(c, error);
      throw error;
    }
  },
);

operationalRoutes.get('/projects/:projectId/milestones', requireAuth, async (c) => {
  const auth = getAuth(c);
  const { db } = createDb(env.DATABASE_URL);
  const projectId = requireParam(c, 'projectId');
  await getProject(db, auth.tenantId, auth, projectId);
  const result = await listProjectMilestones(db, auth.tenantId, projectId);
  return c.json(result);
});

operationalRoutes.get('/projects/:projectId/tasks', requireAuth, async (c) => {
  const auth = getAuth(c);
  const { db } = createDb(env.DATABASE_URL);
  const projectId = requireParam(c, 'projectId');
  await getProject(db, auth.tenantId, auth, projectId);
  const result = await listProjectTasks(db, auth.tenantId, projectId);
  return c.json(result);
});

operationalRoutes.get('/projects/:projectId/timeline', requireAuth, async (c) => {
  const auth = getAuth(c);
  const { db } = createDb(env.DATABASE_URL);
  const projectId = requireParam(c, 'projectId');
  await getProject(db, auth.tenantId, auth, projectId);
  const result = await getProjectTimeline(db, auth.tenantId, projectId, c.req.url);
  return c.json(result);
});

operationalRoutes.get('/projects/:projectId/recommendations', requireAuth, async (c) => {
  const auth = getAuth(c);
  const { db } = createDb(env.DATABASE_URL);
  const projectId = requireParam(c, 'projectId');
  await getProject(db, auth.tenantId, auth, projectId);
  const result = await listProjectRecommendations(db, auth.tenantId, projectId);
  return c.json(result);
});

operationalRoutes.get('/risks', requireAuth, async (c) => {
  try {
    const auth = getAuth(c);
    const { db } = createDb(env.DATABASE_URL);
    const level = c.req.query('level');
    if (level && !RISK_LEVELS.includes(level as (typeof RISK_LEVELS)[number])) {
      return problemResponse(c, badRequest('Invalid risk level filter'));
    }
    const result = await listRisks(db, auth.tenantId, auth, c.req.url);
    return c.json(result);
  } catch (error) {
    if (error instanceof ApiError) return problemResponse(c, error);
    throw error;
  }
});

operationalRoutes.get('/risks/:riskId', requireAuth, async (c) => {
  try {
    const auth = getAuth(c);
    const { db } = createDb(env.DATABASE_URL);
    const risk = await getRisk(db, auth.tenantId, auth, requireParam(c, 'riskId'));
    return c.json({ risk });
  } catch (error) {
    if (error instanceof ApiError) return problemResponse(c, error);
    throw error;
  }
});

operationalRoutes.patch('/risks/:riskId', requireAuth, requireRole('operational'), async (c) => {
  const auth = getAuth(c);
  const body = patchRiskSchema.safeParse(await c.req.json());
  if (!body.success) return problemResponse(c, badRequest(body.error.message));

  const { db } = createDb(env.DATABASE_URL);
  return withIdempotency(c, db, auth.tenantId, async () => {
    const riskId = requireParam(c, 'riskId');
    const risk = await patchRiskStatus(
      db,
      auth.tenantId,
      auth,
      riskId,
      body.data.status,
      body.data.snoozedUntil,
      body.data.feedback,
      body.data.version,
    );

    const auditActionMap: Partial<Record<(typeof RISK_STATUSES)[number], AuditAction>> = {
      acknowledged: 'risk_acknowledged',
      snoozed: 'risk_snoozed',
      resolved: 'risk_resolved',
    };
    const auditAction = auditActionMap[body.data.status];
    if (auditAction) {
      await recordAuditEvent(db, {
        tenantId: auth.tenantId,
        userId: auth.userId,
        action: auditAction,
        resourceType: 'risk',
        resourceId: riskId,
        metadata: { status: body.data.status, feedback: body.data.feedback ?? null },
        ...auditContextFromRequest(c),
      });
    }

    if (body.data.status === 'resolved') {
      const { scheduleOutboundRiskWebhooks } = await import('../../services/webhooks/delivery-service.js');
      scheduleOutboundRiskWebhooks(db, auth.tenantId, [
        {
          eventType: 'risk.resolved',
          tenantId: auth.tenantId,
          riskId,
          projectId: risk.projectId,
          level: risk.level,
          confidence: risk.confidence,
          reason: risk.reason,
          status: 'resolved',
        },
      ]);
    }

    return { status: 200, body: { risk } };
  });
});

operationalRoutes.get('/revenue-impact', requireAuth, async (c) => {
  const auth = getAuth(c);
  const { db } = createDb(env.DATABASE_URL);
  const result = await getRevenueImpact(db, auth.tenantId, auth);
  if (new URL(c.req.url).searchParams.get('format') === 'csv') {
    const rows = result.projects.map((row) => ({
      projectId: row.projectId,
      projectName: row.projectName,
      arrAmount: row.arrAmount,
      openRiskCount: row.openRiskCount,
      highestRiskLevel: row.highestRiskLevel,
    }));
    c.header('Content-Type', 'text/csv; charset=utf-8');
    return c.body(
      rowsToCsv(
        ['projectId', 'projectName', 'arrAmount', 'openRiskCount', 'highestRiskLevel'],
        rows,
      ),
    );
  }
  c.header('Cache-Control', result.cached ? 'private, max-age=60' : 'private, max-age=30');
  return c.json(result);
});

operationalRoutes.get('/integrations', requireAuth, requireRole('operational'), async (c) => {
  const auth = getAuth(c);
  const { db } = createDb(env.DATABASE_URL);
  const result = await listIntegrations(db, auth.tenantId);
  return c.json(result);
});

operationalRoutes.get('/integrations/catalog', requireAuth, requireRole('operational'), async (c) => {
  const auth = getAuth(c);
  const { db } = createDb(env.DATABASE_URL);
  const catalog = await getIntegrationCatalog(db, auth.tenantId);
  return c.json(catalog);
});

operationalRoutes.get(
  '/integrations/:integrationId/mappings',
  requireAuth,
  requireRole('operational'),
  async (c) => {
    const auth = getAuth(c);
    const { db } = createDb(env.DATABASE_URL);
    const result = await listIntegrationMappings(
      db,
      auth.tenantId,
      requireParam(c, 'integrationId'),
    );
    return c.json(result);
  },
);

operationalRoutes.post('/integration-mappings', requireAuth, requireRole('admin'), async (c) => {
  const auth = getAuth(c);
  const body = createMappingSchema.safeParse(await c.req.json());
  if (!body.success) return problemResponse(c, badRequest(body.error.message));

  const { db } = createDb(env.DATABASE_URL);
  return withIdempotency(c, db, auth.tenantId, async () => {
    const mapping = await createIntegrationMapping(db, auth.tenantId, body.data);
    return { status: 201, body: { mapping } };
  });
});
