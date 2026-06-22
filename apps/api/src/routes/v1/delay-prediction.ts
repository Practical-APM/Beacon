import { createDb } from '@beacon/db';
import { Hono } from 'hono';
import { env } from '../../env.js';
import { notFound, problemResponse } from '../../lib/errors.js';
import { getAuth, requireAuth } from '../../middleware/auth.js';
import { getProjectDelayPrediction } from '../../services/predictions/delay-prediction-service.js';

export const delayPredictionRoutes = new Hono();

delayPredictionRoutes.get('/projects/:projectId/delay-prediction', requireAuth, async (c) => {
  const auth = getAuth(c);
  const projectId = c.req.param('projectId');
  if (!projectId) return problemResponse(c, notFound('Project not found'));

  const { db } = createDb(env.DATABASE_URL);
  const prediction = await getProjectDelayPrediction(db, auth.tenantId, auth, projectId);
  if (!prediction) return problemResponse(c, notFound('Project not found'));

  return c.json({ prediction });
});
