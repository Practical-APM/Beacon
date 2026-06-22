import { notifications, withTenantContext, type Database } from '@beacon/db';
import type { NotificationType } from '@beacon/shared/notifications';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { serializeRecord } from '../../lib/query.js';

export async function createInAppNotification(
  db: Database,
  input: {
    tenantId: string;
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    metadata?: Record<string, unknown>;
  },
) {
  return withTenantContext(db, input.tenantId, async () => {
    const [row] = await db
      .insert(notifications)
      .values({
        tenantId: input.tenantId,
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        metadata: input.metadata ?? {},
      })
      .returning();
    return serializeRecord(row!);
  });
}

export async function listInAppNotifications(
  db: Database,
  tenantId: string,
  userId: string,
  limit = 20,
) {
  return withTenantContext(db, tenantId, async () => {
    const rows = await db
      .select()
      .from(notifications)
      .where(and(eq(notifications.tenantId, tenantId), eq(notifications.userId, userId)))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
    return rows.map(serializeRecord);
  });
}

export async function getUnreadCount(db: Database, tenantId: string, userId: string) {
  return withTenantContext(db, tenantId, async () => {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(
        and(
          eq(notifications.tenantId, tenantId),
          eq(notifications.userId, userId),
          isNull(notifications.readAt),
        ),
      );
    return row?.count ?? 0;
  });
}

export async function markNotificationRead(
  db: Database,
  tenantId: string,
  userId: string,
  notificationId: string,
) {
  return withTenantContext(db, tenantId, async () => {
    const [row] = await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notifications.id, notificationId),
          eq(notifications.tenantId, tenantId),
          eq(notifications.userId, userId),
        ),
      )
      .returning();
    return row ? serializeRecord(row) : null;
  });
}

export async function markAllNotificationsRead(db: Database, tenantId: string, userId: string) {
  return withTenantContext(db, tenantId, async () => {
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notifications.tenantId, tenantId),
          eq(notifications.userId, userId),
          isNull(notifications.readAt),
        ),
      );
  });
}
