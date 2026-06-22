import { createDb } from '@beacon/db';
import { RISK_LEVELS } from '@beacon/shared/constants';
import { RISK_RULE_KEYS } from '@beacon/shared';
import { Hono } from 'hono';
import { z } from 'zod';
import { env } from '../../env.js';
import { badRequest, problemResponse } from '../../lib/errors.js';
import { getAuth, requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { auditContextFromRequest, recordAuditEvent } from '../../services/audit/audit-service.js';
import {
  getLatestRiskEvaluationJob,
  runRiskEvaluation,
  startRiskEvaluation,
} from '../../services/risk/engine.js';
import {
  getTenantRiskRules,
  resetTenantRiskRules,
  updateTenantRiskRules,
} from '../../services/risk/settings-service.js';

const evaluateSchema = z.object({
  projectId: z.string().uuid().optional(),
});

const rulePatchSchema = z.object({
  enabled: z.boolean().optional(),
  level: z.enum(RISK_LEVELS).optional(),
  baseScore: z.number().int().min(0).max(100).optional(),
  thresholdBusinessDays: z.number().int().min(1).max(90).optional(),
});

const riskRulesPatchSchema = z.object({
  timezone: z.string().min(1).max(64).optional(),
  hysteresisBuffer: z.number().int().min(0).max(20).optional(),
  acknowledgedSuppressionDays: z.number().int().min(1).max(30).optional(),
  rules: z
    .record(z.enum(RISK_RULE_KEYS), rulePatchSchema)
    .optional(),
});

export const riskAdminRoutes = new Hono();

riskAdminRoutes.post('/risks/evaluate', requireAuth, requireRole('admin'), async (c) => {
  const auth = getAuth(c);
  const body = evaluateSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return problemResponse(c, badRequest(body.error.message));

  const { db } = createDb(env.DATABASE_URL);
  startRiskEvaluation(db, auth.tenantId, 'manual', body.data.projectId);
  return c.json({ status: 'started' });
});

riskAdminRoutes.post('/risks/evaluate/sync', requireAuth, requireRole('admin'), async (c) => {
  const auth = getAuth(c);
  const body = evaluateSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return problemResponse(c, badRequest(body.error.message));

  const { db } = createDb(env.DATABASE_URL);
  const result = await runRiskEvaluation(db, auth.tenantId, 'manual', body.data.projectId);
  return c.json(result);
});

riskAdminRoutes.get('/risks/evaluate/status', requireAuth, requireRole('operational'), async (c) => {
  const auth = getAuth(c);
  const { db } = createDb(env.DATABASE_URL);
  const job = await getLatestRiskEvaluationJob(db, auth.tenantId);
  return c.json({ job });
});

riskAdminRoutes.get('/admin/risk-rules', requireAuth, requireRole('admin'), async (c) => {
  const auth = getAuth(c);
  const { db } = createDb(env.DATABASE_URL);
  const rules = await getTenantRiskRules(db, auth.tenantId);
  return c.json({ rules });
});

riskAdminRoutes.patch('/admin/risk-rules', requireAuth, requireRole('admin'), async (c) => {
  const auth = getAuth(c);
  const body = riskRulesPatchSchema.safeParse(await c.req.json());
  if (!body.success) return problemResponse(c, badRequest(body.error.message));

  const { db } = createDb(env.DATABASE_URL);
  const rules = await updateTenantRiskRules(db, auth.tenantId, body.data);
  await recordAuditEvent(db, {
    tenantId: auth.tenantId,
    userId: auth.userId,
    action: 'risk_rules_updated',
    resourceType: 'tenant_risk_settings',
    resourceId: auth.tenantId,
    metadata: body.data,
    ...auditContextFromRequest(c),
  });
  startRiskEvaluation(db, auth.tenantId, 'manual');
  return c.json({ rules });
});

riskAdminRoutes.post('/admin/risk-rules/reset', requireAuth, requireRole('admin'), async (c) => {
  const auth = getAuth(c);
  const { db } = createDb(env.DATABASE_URL);
  const rules = await resetTenantRiskRules(db, auth.tenantId);
  await recordAuditEvent(db, {
    tenantId: auth.tenantId,
    userId: auth.userId,
    action: 'risk_rules_updated',
    resourceType: 'tenant_risk_settings',
    resourceId: auth.tenantId,
    metadata: { reset: true },
    ...auditContextFromRequest(c),
  });
  startRiskEvaluation(db, auth.tenantId, 'manual');
  return c.json({ rules });
});
