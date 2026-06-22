import { createDb } from '@beacon/db';
import { Hono } from 'hono';
import { z } from 'zod';
import { env } from '../../env.js';
import { badRequest, notFound, problemResponse } from '../../lib/errors.js';
import { getAuth, requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { getProject } from '../../services/operational-service.js';
import {
  generateProjectInsights,
  getInsightByRiskId,
  getIntelligenceStatus,
  listProjectInsights,
  updateIntelligenceSettings,
} from '../../services/intelligence/engine.js';

const settingsSchema = z.object({
  llmEnabled: z.boolean().optional(),
  locale: z.string().min(2).max(10).optional(),
  dailyTokenCap: z.number().int().min(1000).max(1_000_000).optional(),
  maxTokensPerRequest: z.number().int().min(100).max(4000).optional(),
  provider: z.enum(['openai', 'anthropic', 'mock']).optional(),
});

export const insightRoutes = new Hono();

insightRoutes.get('/projects/:projectId/insights', requireAuth, requireRole('operational'), async (c) => {
  const auth = getAuth(c);
  const projectId = c.req.param('projectId');
  if (!projectId) return problemResponse(c, badRequest('Missing projectId'));

  const { db } = createDb(env.DATABASE_URL);
  await getProject(db, auth.tenantId, auth, projectId);
  const insights = await listProjectInsights(db, auth.tenantId, projectId);
  return c.json({ data: insights });
});

insightRoutes.post(
  '/projects/:projectId/insights/generate',
  requireAuth,
  requireRole('operational'),
  async (c) => {
    const auth = getAuth(c);
    const projectId = c.req.param('projectId');
    if (!projectId) return problemResponse(c, badRequest('Missing projectId'));

    const body = (await c.req.json().catch(() => ({}))) as { riskId?: string };
    const { db } = createDb(env.DATABASE_URL);
    await getProject(db, auth.tenantId, auth, projectId);

    const insights = await generateProjectInsights(
      db,
      auth.tenantId,
      projectId,
      body.riskId,
    );
    return c.json({ data: insights });
  },
);

export const intelligenceAdminRoutes = new Hono();

intelligenceAdminRoutes.get('/admin/intelligence', requireAuth, requireRole('admin'), async (c) => {
  const auth = getAuth(c);
  const { db } = createDb(env.DATABASE_URL);
  const status = await getIntelligenceStatus(db, auth.tenantId);
  return c.json(status);
});

intelligenceAdminRoutes.patch('/admin/intelligence', requireAuth, requireRole('admin'), async (c) => {
  const auth = getAuth(c);
  const body = settingsSchema.safeParse(await c.req.json());
  if (!body.success) return problemResponse(c, badRequest(body.error.message));

  const { db } = createDb(env.DATABASE_URL);
  const settings = await updateIntelligenceSettings(db, auth.tenantId, body.data);
  return c.json({ settings });
});

insightRoutes.get('/risks/:riskId/insight', requireAuth, requireRole('operational'), async (c) => {
  const auth = getAuth(c);
  const riskId = c.req.param('riskId');
  if (!riskId) return problemResponse(c, badRequest('Missing riskId'));

  const { db } = createDb(env.DATABASE_URL);
  const insight = await getInsightByRiskId(db, auth.tenantId, riskId);
  if (!insight) return problemResponse(c, notFound('Insight not found'));
  return c.json({ insight });
});
