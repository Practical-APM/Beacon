import { createDb, users } from '@beacon/db';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { env } from '../../env.js';
import { getAuth, requireAuth } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/rbac.js';
import { upsertUser } from '../../services/tenant-service.js';
import { bearerToken, verifyAccessToken } from '../../lib/auth.js';
import { badRequest, problemResponse } from '../../lib/errors.js';

export const adminRoutes = new Hono();

adminRoutes.post('/admin/sync', requireAuth, requireAdmin(), async (c) => {
  const auth = getAuth(c);
  const token = bearerToken(c.req.header('Authorization'));
  if (!token) {
    return problemResponse(c, badRequest('Authorization header required'));
  }

  const identity = await verifyAccessToken(token);
  const { db } = createDb(env.DATABASE_URL);
  const user = await upsertUser(db, identity);

  const [freshUser] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
  return c.json({
    synced: true,
    user: freshUser,
    requestedBy: auth.userId,
  });
});
