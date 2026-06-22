import { createDb, users } from '@beacon/db';
import { DPA_DOCUMENT, DPA_VERSION } from '@beacon/shared/legal';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { env } from '../../env.js';
import { badRequest, problemResponse } from '../../lib/errors.js';
import { getAuth, getUserId, requireAuth, requireUser } from '../../middleware/auth.js';
import { auditContextFromRequest, recordAuditEvent } from '../../services/audit/audit-service.js';
import { buildMeResponse } from '../../services/tenant-service.js';

export const legalRoutes = new Hono();

legalRoutes.get('/legal/dpa', async (c) => {
  return c.json({ document: DPA_DOCUMENT });
});

legalRoutes.post('/legal/dpa/accept', requireAuth, async (c) => {
  const auth = getAuth(c);
  const { db } = createDb(env.DATABASE_URL);

  await db
    .update(users)
    .set({
      dpaAcceptedAt: new Date(),
      dpaVersion: DPA_VERSION,
      updatedAt: new Date(),
    })
    .where(eq(users.id, auth.userId));

  await recordAuditEvent(db, {
    tenantId: auth.tenantId,
    userId: auth.userId,
    action: 'dpa_accepted',
    resourceType: 'legal',
    resourceId: DPA_VERSION,
    metadata: { document: 'dpa' },
    ...auditContextFromRequest(c),
  });

  const [user] = await db.select().from(users).where(eq(users.id, auth.userId)).limit(1);
  if (!user) return problemResponse(c, badRequest('User not found'));

  const me = await buildMeResponse(db, user, auth.tenantId);
  return c.json({ me, accepted: true, version: DPA_VERSION });
});

legalRoutes.get('/legal/dpa/status', requireUser, async (c) => {
  const userId = getUserId(c);
  const { db } = createDb(env.DATABASE_URL);
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return problemResponse(c, badRequest('User not found'));

  return c.json({
    version: DPA_VERSION,
    acceptedAt: user.dpaAcceptedAt?.toISOString() ?? null,
    acceptedVersion: user.dpaVersion ?? null,
    current: user.dpaVersion === DPA_VERSION && Boolean(user.dpaAcceptedAt),
  });
});
