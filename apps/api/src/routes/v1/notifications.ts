import { createDb } from '@beacon/db';
import { NOTIFICATION_TYPES } from '@beacon/shared/notifications';
import { RISK_LEVELS } from '@beacon/shared/constants';
import { Hono } from 'hono';
import { z } from 'zod';
import { env } from '../../env.js';
import { badRequest, notFound, problemResponse } from '../../lib/errors.js';
import { getAuth, requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import {
  getPreferencesForUser,
  getTenantNotificationSettings,
  unsubscribeByToken,
  updatePreferencesForUser,
  updateTenantNotificationSettings,
} from '../../services/notifications/preferences.js';
import {
  getUnreadCount,
  listInAppNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../../services/notifications/in-app.js';
import { runDailyDigests } from '../../services/notifications/digest.js';

const preferencesSchema = z.object({
  emailEnabled: z.boolean().optional(),
  inAppEnabled: z.boolean().optional(),
  slackEnabled: z.boolean().optional(),
  frequency: z.enum(['daily', 'immediate_only', 'off']).optional(),
  minSeverity: z.enum(RISK_LEVELS).optional(),
  minConfidence: z.number().int().min(0).max(100).optional(),
  digestHourLocal: z.number().int().min(0).max(23).optional(),
  timezone: z.string().min(2).max(64).optional(),
  globalSnoozeUntil: z.string().datetime().nullable().optional(),
});

const tenantSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  digestEnabled: z.boolean().optional(),
  immediateAlertsEnabled: z.boolean().optional(),
  orgMinSeverity: z.enum(RISK_LEVELS).optional(),
});

export const notificationRoutes = new Hono();

notificationRoutes.get('/notifications', requireAuth, async (c) => {
  const auth = getAuth(c);
  const { db } = createDb(env.DATABASE_URL);
  const data = await listInAppNotifications(db, auth.tenantId, auth.userId);
  return c.json({ data });
});

notificationRoutes.get('/notifications/unread-count', requireAuth, async (c) => {
  const auth = getAuth(c);
  const { db } = createDb(env.DATABASE_URL);
  const count = await getUnreadCount(db, auth.tenantId, auth.userId);
  return c.json({ count });
});

notificationRoutes.patch('/notifications/:notificationId/read', requireAuth, async (c) => {
  const auth = getAuth(c);
  const notificationId = c.req.param('notificationId');
  if (!notificationId) return problemResponse(c, badRequest('Missing notificationId'));

  const { db } = createDb(env.DATABASE_URL);
  const row = await markNotificationRead(db, auth.tenantId, auth.userId, notificationId);
  if (!row) return problemResponse(c, notFound('Notification not found'));
  return c.json({ notification: row });
});

notificationRoutes.post('/notifications/read-all', requireAuth, async (c) => {
  const auth = getAuth(c);
  const { db } = createDb(env.DATABASE_URL);
  await markAllNotificationsRead(db, auth.tenantId, auth.userId);
  return c.body(null, 204);
});

notificationRoutes.get('/notifications/preferences', requireAuth, async (c) => {
  const auth = getAuth(c);
  const { db } = createDb(env.DATABASE_URL);
  const preferences = await getPreferencesForUser(db, auth.tenantId, auth.userId);
  return c.json({ preferences });
});

notificationRoutes.patch('/notifications/preferences', requireAuth, async (c) => {
  const auth = getAuth(c);
  const body = preferencesSchema.safeParse(await c.req.json());
  if (!body.success) return problemResponse(c, badRequest(body.error.message));

  const { db } = createDb(env.DATABASE_URL);
  const preferences = await updatePreferencesForUser(db, auth.tenantId, auth.userId, body.data);
  return c.json({ preferences });
});

notificationRoutes.get('/admin/notifications/settings', requireAuth, requireRole('admin'), async (c) => {
  const auth = getAuth(c);
  const { db } = createDb(env.DATABASE_URL);
  const settings = await getTenantNotificationSettings(db, auth.tenantId);
  return c.json({ settings });
});

notificationRoutes.patch('/admin/notifications/settings', requireAuth, requireRole('admin'), async (c) => {
  const auth = getAuth(c);
  const body = tenantSettingsSchema.safeParse(await c.req.json());
  if (!body.success) return problemResponse(c, badRequest(body.error.message));

  const { db } = createDb(env.DATABASE_URL);
  const settings = await updateTenantNotificationSettings(db, auth.tenantId, body.data);
  return c.json({ settings });
});

notificationRoutes.post('/admin/notifications/run-digest', requireAuth, requireRole('admin'), async (c) => {
  const { db } = createDb(env.DATABASE_URL);
  const sent = await runDailyDigests(db);
  return c.json({ sent });
});

export const notificationPublicRoutes = new Hono();

notificationPublicRoutes.get('/notifications/unsubscribe', async (c) => {
  const token = c.req.query('token');
  const type = c.req.query('type') ?? 'daily_digest';
  if (!token) return c.text('Missing unsubscribe token', 400);

  const { db } = createDb(env.DATABASE_URL);
  const ok = await unsubscribeByToken(
    db,
    token,
    NOTIFICATION_TYPES.includes(type as (typeof NOTIFICATION_TYPES)[number])
      ? (type as (typeof NOTIFICATION_TYPES)[number])
      : 'daily_digest',
  );
  if (!ok) return c.text('Invalid or expired unsubscribe link', 404);
  return c.html(
    `<html><body style="font-family: sans-serif; padding: 2rem;"><h1>Unsubscribed</h1><p>You will no longer receive ${type.replace(/_/g, ' ')} emails from Beacon.</p></body></html>`,
  );
});
