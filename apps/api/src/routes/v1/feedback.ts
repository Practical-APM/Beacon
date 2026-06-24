import { createDb } from '@beacon/db';
import { FEEDBACK_RATINGS, FEEDBACK_TARGET_TYPES } from '@beacon/shared/recommendation-feedback';
import { Hono } from 'hono';
import { z } from 'zod';
import { env } from '../../env.js';
import { badRequest, problemResponse } from '../../lib/errors.js';
import { getAuth, requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { auditContextFromRequest, recordAuditEvent } from '../../services/audit/audit-service.js';
import { getProject } from '../../services/operational-service.js';
import {
  exportTrainingFeedback,
  getFeedbackSummary,
  listProjectFeedbackForUser,
  submitRecommendationFeedback,
} from '../../services/feedback/feedback-service.js';

const submitSchema = z.object({
  projectId: z.string().uuid(),
  targetType: z.enum(FEEDBACK_TARGET_TYPES),
  targetId: z.string().uuid(),
  rating: z.enum(FEEDBACK_RATINGS),
  comment: z.string().max(500).optional(),
});

export const feedbackRoutes = new Hono();

feedbackRoutes.post('/feedback', requireAuth, requireRole('operational'), async (c) => {
  const auth = getAuth(c);
  const parsed = submitSchema.safeParse(await c.req.json());
  if (!parsed.success) return problemResponse(c, badRequest(parsed.error.message));

  const { db } = createDb(env.DATABASE_URL);
  await getProject(db, auth.tenantId, auth, parsed.data.projectId);

  try {
    const feedback = await submitRecommendationFeedback(
      db,
      auth.tenantId,
      auth.userId,
      parsed.data,
    );
    await recordAuditEvent(db, {
      tenantId: auth.tenantId,
      userId: auth.userId,
      action: 'recommendation_feedback_submitted',
      resourceType: 'recommendation_feedback',
      resourceId: feedback.id,
      metadata: {
        targetType: feedback.targetType,
        rating: feedback.rating,
        projectId: feedback.projectId,
        riskId: feedback.riskId,
      },
      ...auditContextFromRequest(c),
    });
    return c.json({ feedback }, 201);
  } catch (error) {
    return problemResponse(
      c,
      badRequest(error instanceof Error ? error.message : 'Failed to submit feedback'),
    );
  }
});

feedbackRoutes.get('/projects/:projectId/feedback', requireAuth, requireRole('operational'), async (c) => {
  const auth = getAuth(c);
  const projectId = c.req.param('projectId');
  if (!projectId) return problemResponse(c, badRequest('Missing projectId'));

  const { db } = createDb(env.DATABASE_URL);
  await getProject(db, auth.tenantId, auth, projectId);
  const data = await listProjectFeedbackForUser(db, auth.tenantId, auth.userId, projectId);
  return c.json({ data });
});

feedbackRoutes.get('/admin/feedback/summary', requireAuth, requireRole('admin'), async (c) => {
  const auth = getAuth(c);
  const { db } = createDb(env.DATABASE_URL);
  const summary = await getFeedbackSummary(db, auth.tenantId);
  return c.json({ summary });
});

feedbackRoutes.get('/admin/feedback/export', requireAuth, requireRole('admin'), async (c) => {
  const auth = getAuth(c);
  const limit = Number(c.req.query('limit') ?? '1000');
  const { db } = createDb(env.DATABASE_URL);
  const data = await exportTrainingFeedback(db, auth.tenantId, limit);
  return c.json({ data, count: data.length });
});
