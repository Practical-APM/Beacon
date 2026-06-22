import { createDb } from '@beacon/db';
import { Hono } from 'hono';
import { z } from 'zod';
import { AUDIT_ACTIONS } from '@beacon/shared/audit';
import type { AuditAction } from '@beacon/shared/audit';
import { env } from '../../env.js';
import { badRequest, problemResponse } from '../../lib/errors.js';
import { getAuth, requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { auditContextFromRequest, listAuditEvents, recordAuditEvent } from '../../services/audit/audit-service.js';
import {
  createDeletionRequest,
  exportUserData,
  listDeletionRequests,
  processDeletionRequest,
  updateTenantFeatureFlags,
} from '../../services/privacy/gdpr-service.js';
import { getResolvedFeatureFlags } from '../../services/feature-flags.js';

const deletionRequestSchema = z.object({
  notes: z.string().max(2000).optional(),
});

const deletionActionSchema = z.object({
  action: z.enum(['complete', 'reject']),
});

const featureFlagsSchema = z.object({
  llmEnabled: z.boolean().optional(),
  slackAlertsEnabled: z.boolean().optional(),
  outboundWebhooksEnabled: z.boolean().optional(),
  benchmarkParticipationEnabled: z.boolean().optional(),
  delayPredictionsEnabled: z.boolean().optional(),
});

export const complianceRoutes = new Hono();

complianceRoutes.get('/admin/audit-events', requireAuth, requireRole('admin'), async (c) => {
  const auth = getAuth(c);
  const actionParam = c.req.query('action');
  const action =
    actionParam && AUDIT_ACTIONS.includes(actionParam as AuditAction)
      ? (actionParam as AuditAction)
      : undefined;
  const limit = Number(c.req.query('limit') ?? '50');
  const { db } = createDb(env.DATABASE_URL);
  const data = await listAuditEvents(db, auth.tenantId, { action, limit });
  return c.json({ data });
});

complianceRoutes.post('/privacy/export', requireAuth, async (c) => {
  const auth = getAuth(c);
  const { db } = createDb(env.DATABASE_URL);
  const exportPayload = await exportUserData(db, auth.tenantId, auth.userId);
  await recordAuditEvent(db, {
    tenantId: auth.tenantId,
    userId: auth.userId,
    action: 'gdpr_export_requested',
    resourceType: 'user',
    resourceId: auth.userId,
    ...auditContextFromRequest(c),
  });
  return c.json({ export: exportPayload });
});

complianceRoutes.post('/privacy/deletion-request', requireAuth, async (c) => {
  const auth = getAuth(c);
  const body = deletionRequestSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return problemResponse(c, badRequest(body.error.message));

  const { db } = createDb(env.DATABASE_URL);
  const request = await createDeletionRequest(db, auth.tenantId, auth.userId, body.data.notes);
  await recordAuditEvent(db, {
    tenantId: auth.tenantId,
    userId: auth.userId,
    action: 'gdpr_deletion_requested',
    resourceType: 'user',
    resourceId: auth.userId,
    metadata: { requestId: request?.id },
    ...auditContextFromRequest(c),
  });
  return c.json({ request }, 201);
});

complianceRoutes.get('/admin/privacy/deletion-requests', requireAuth, requireRole('admin'), async (c) => {
  const auth = getAuth(c);
  const { db } = createDb(env.DATABASE_URL);
  const data = await listDeletionRequests(db, auth.tenantId);
  return c.json({ data });
});

complianceRoutes.patch(
  '/admin/privacy/deletion-requests/:requestId',
  requireAuth,
  requireRole('admin'),
  async (c) => {
    const auth = getAuth(c);
    const requestId = c.req.param('requestId');
    if (!requestId) return problemResponse(c, badRequest('Missing requestId'));

    const body = deletionActionSchema.safeParse(await c.req.json());
    if (!body.success) return problemResponse(c, badRequest(body.error.message));

    const { db } = createDb(env.DATABASE_URL);
    const request = await processDeletionRequest(
      db,
      auth.tenantId,
      requestId,
      body.data.action,
    );
    await recordAuditEvent(db, {
      tenantId: auth.tenantId,
      userId: auth.userId,
      action:
        body.data.action === 'complete' ? 'gdpr_deletion_completed' : 'gdpr_deletion_rejected',
      resourceType: 'user',
      resourceId: request?.userId ?? null,
      metadata: { requestId },
      ...auditContextFromRequest(c),
    });
    return c.json({ request });
  },
);

complianceRoutes.get('/admin/feature-flags', requireAuth, requireRole('admin'), async (c) => {
  const auth = getAuth(c);
  const { db } = createDb(env.DATABASE_URL);
  const flags = await getResolvedFeatureFlags(db, auth.tenantId);
  return c.json({ flags });
});

complianceRoutes.patch('/admin/feature-flags', requireAuth, requireRole('admin'), async (c) => {
  const auth = getAuth(c);
  const body = featureFlagsSchema.safeParse(await c.req.json());
  if (!body.success) return problemResponse(c, badRequest(body.error.message));

  const { db } = createDb(env.DATABASE_URL);
  await updateTenantFeatureFlags(db, auth.tenantId, body.data);
  const flags = await getResolvedFeatureFlags(db, auth.tenantId);
  return c.json({ flags });
});
