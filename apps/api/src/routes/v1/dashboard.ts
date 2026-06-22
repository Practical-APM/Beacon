import { createDb } from '@beacon/db';
import { Hono } from 'hono';
import { env } from '../../env.js';
import { getAuth, requireAuth } from '../../middleware/auth.js';
import { getDashboardSummary } from '../../services/dashboard-service.js';

export const dashboardRoutes = new Hono();

dashboardRoutes.get('/dashboard', requireAuth, async (c) => {
  const auth = getAuth(c);
  const { db } = createDb(env.DATABASE_URL);
  const summary = await getDashboardSummary(db, auth.tenantId, auth);
  c.header('Cache-Control', summary.cached ? 'private, max-age=60' : 'private, max-age=30');
  return c.json(summary);
});
