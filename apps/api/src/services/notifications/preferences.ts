import { randomBytes } from 'node:crypto';
import {
  notificationPreferences,
  tenants,
  users,
  withTenantContext,
  type Database,
} from '@beacon/db';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  DEFAULT_TENANT_NOTIFICATION_SETTINGS,
  type NotificationFrequency,
  type NotificationPreferences,
  type NotificationType,
  type TenantNotificationSettings,
} from '@beacon/shared/notifications';
import type { RiskLevel } from '@beacon/shared/constants';
import { and, eq } from 'drizzle-orm';

export async function ensureUnsubscribeToken(db: Database, userId: string): Promise<string> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new Error('User not found');
  if (user.unsubscribeToken) return user.unsubscribeToken;

  const token = randomBytes(24).toString('hex');
  await db.update(users).set({ unsubscribeToken: token, updatedAt: new Date() }).where(eq(users.id, userId));
  return token;
}

export async function getOrCreatePreferences(db: Database, tenantId: string, userId: string) {
  return withTenantContext(db, tenantId, async () => {
    const [existing] = await db
      .select()
      .from(notificationPreferences)
      .where(and(eq(notificationPreferences.tenantId, tenantId), eq(notificationPreferences.userId, userId)))
      .limit(1);

    if (existing) return normalizePreferencesRow(existing);

    const [row] = await db
      .insert(notificationPreferences)
      .values({ tenantId, userId })
      .returning();
    return normalizePreferencesRow(row!);
  });
}

function normalizePreferencesRow(
  row: typeof notificationPreferences.$inferSelect,
): typeof notificationPreferences.$inferSelect & { frequency: NotificationFrequency } {
  return {
    ...row,
    frequency: row.frequency as NotificationFrequency,
  };
}

export async function getTenantNotificationSettings(
  db: Database,
  tenantId: string,
): Promise<Required<TenantNotificationSettings>> {
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  const raw = (tenant?.notificationSettings ?? {}) as TenantNotificationSettings;
  return {
    ...DEFAULT_TENANT_NOTIFICATION_SETTINGS,
    ...raw,
  };
}

export async function updateTenantNotificationSettings(
  db: Database,
  tenantId: string,
  input: Partial<TenantNotificationSettings>,
) {
  const current = await getTenantNotificationSettings(db, tenantId);
  const next = { ...current, ...input };
  await db
    .update(tenants)
    .set({ notificationSettings: next, updatedAt: new Date() })
    .where(eq(tenants.id, tenantId));
  return next;
}

export async function getPreferencesForUser(
  db: Database,
  tenantId: string,
  userId: string,
): Promise<NotificationPreferences & { lastDigestSentAt: string | null }> {
  const [user, prefs] = await Promise.all([
    db.select().from(users).where(eq(users.id, userId)).limit(1).then((rows) => rows[0]),
    getOrCreatePreferences(db, tenantId, userId),
  ]);

  return {
    emailEnabled: prefs.emailEnabled,
    inAppEnabled: prefs.inAppEnabled,
    slackEnabled: prefs.slackEnabled,
    frequency: prefs.frequency as NotificationFrequency,
    minSeverity: prefs.minSeverity as RiskLevel,
    minConfidence: prefs.minConfidence,
    digestHourLocal: prefs.digestHourLocal,
    unsubscribedTypes: (prefs.unsubscribedTypes ?? []) as NotificationType[],
    globalSnoozeUntil: user?.globalSnoozeUntil?.toISOString() ?? null,
    timezone: user?.timezone ?? 'UTC',
    lastDigestSentAt: prefs.lastDigestSentAt?.toISOString() ?? null,
  };
}

export async function updatePreferencesForUser(
  db: Database,
  tenantId: string,
  userId: string,
  input: Partial<NotificationPreferences>,
) {
  await getOrCreatePreferences(db, tenantId, userId);

  if (input.timezone != null || input.globalSnoozeUntil !== undefined) {
    await db
      .update(users)
      .set({
        timezone: input.timezone ?? undefined,
        globalSnoozeUntil:
          input.globalSnoozeUntil === null
            ? null
            : input.globalSnoozeUntil
              ? new Date(input.globalSnoozeUntil)
              : undefined,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  const [row] = await withTenantContext(db, tenantId, async () =>
    db
      .update(notificationPreferences)
      .set({
        emailEnabled: input.emailEnabled,
        inAppEnabled: input.inAppEnabled,
        slackEnabled: input.slackEnabled,
        frequency: input.frequency,
        minSeverity: input.minSeverity,
        minConfidence: input.minConfidence,
        digestHourLocal: input.digestHourLocal,
        unsubscribedTypes: input.unsubscribedTypes,
        updatedAt: new Date(),
      })
      .where(and(eq(notificationPreferences.tenantId, tenantId), eq(notificationPreferences.userId, userId)))
      .returning(),
  );

  return getPreferencesForUser(db, tenantId, userId);
}

export async function unsubscribeByToken(
  db: Database,
  token: string,
  type: NotificationType,
): Promise<boolean> {
  const [user] = await db.select().from(users).where(eq(users.unsubscribeToken, token)).limit(1);
  if (!user) return false;

  const memberships = await db
    .select({ tenantId: notificationPreferences.tenantId })
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, user.id));

  for (const membership of memberships) {
    const prefs = await getOrCreatePreferences(db, membership.tenantId, user.id);
    const unsubscribed = new Set([...(prefs.unsubscribedTypes ?? []), type]);
    await withTenantContext(db, membership.tenantId, async () => {
      await db
        .update(notificationPreferences)
        .set({
          unsubscribedTypes: [...unsubscribed],
          emailEnabled: type === 'daily_digest' ? false : prefs.emailEnabled,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(notificationPreferences.tenantId, membership.tenantId),
            eq(notificationPreferences.userId, user.id),
          ),
        );
    });
  }

  return true;
}

export { DEFAULT_NOTIFICATION_PREFERENCES, DEFAULT_TENANT_NOTIFICATION_SETTINGS };
