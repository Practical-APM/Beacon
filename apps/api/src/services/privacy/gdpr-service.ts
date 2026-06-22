import {
  deletionRequests,
  notificationPreferences,
  notifications,
  tenantMemberships,
  tenants,
  users,
  withTenantContext,
  type Database,
} from '@beacon/db';
import type { DeletionRequestStatus } from '@beacon/shared/privacy';
import type { GdprExportPayload } from '@beacon/shared/privacy';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { notFound } from '../../lib/errors.js';

function serializeDeletionRequest(row: typeof deletionRequests.$inferSelect) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    userId: row.userId,
    status: row.status,
    notes: row.notes,
    requestedAt: row.requestedAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
  };
}

export async function exportUserData(
  db: Database,
  tenantId: string,
  userId: string,
): Promise<GdprExportPayload> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new Error('User not found');

  const memberships = await db
    .select({
      tenantId: tenantMemberships.tenantId,
      role: tenantMemberships.role,
    })
    .from(tenantMemberships)
    .where(and(eq(tenantMemberships.userId, userId), isNull(tenantMemberships.deletedAt)));

  const [prefs] = await withTenantContext(db, tenantId, async () =>
    db
      .select()
      .from(notificationPreferences)
      .where(and(eq(notificationPreferences.tenantId, tenantId), eq(notificationPreferences.userId, userId)))
      .limit(1),
  );

  const inApp = await withTenantContext(db, tenantId, async () =>
    db
      .select({
        id: notifications.id,
        type: notifications.type,
        title: notifications.title,
        body: notifications.body,
        metadata: notifications.metadata,
        readAt: notifications.readAt,
        createdAt: notifications.createdAt,
      })
      .from(notifications)
      .where(and(eq(notifications.tenantId, tenantId), eq(notifications.userId, userId)))
      .orderBy(desc(notifications.createdAt))
      .limit(500),
  );

  return {
    exportedAt: new Date().toISOString(),
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      timezone: user.timezone,
    },
    memberships: memberships.map((row) => ({ tenantId: row.tenantId, role: row.role })),
    notificationPreferences: prefs
      ? {
          emailEnabled: prefs.emailEnabled,
          inAppEnabled: prefs.inAppEnabled,
          slackEnabled: prefs.slackEnabled,
          frequency: prefs.frequency,
          minSeverity: prefs.minSeverity,
          minConfidence: prefs.minConfidence,
          digestHourLocal: prefs.digestHourLocal,
        }
      : null,
    notifications: inApp.map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      body: row.body,
      metadata: row.metadata,
      readAt: row.readAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    })),
  };
}

export async function createDeletionRequest(
  db: Database,
  tenantId: string,
  userId: string,
  notes?: string,
) {
  return withTenantContext(db, tenantId, async () => {
    const [existing] = await db
      .select()
      .from(deletionRequests)
      .where(
        and(
          eq(deletionRequests.tenantId, tenantId),
          eq(deletionRequests.userId, userId),
          eq(deletionRequests.status, 'pending'),
        ),
      )
      .limit(1);

    if (existing) {
      return serializeDeletionRequest(existing);
    }

    const [row] = await db
      .insert(deletionRequests)
      .values({
        tenantId,
        userId,
        notes: notes ?? null,
      })
      .returning();

    return row ? serializeDeletionRequest(row) : null;
  });
}

export async function listDeletionRequests(db: Database, tenantId: string) {
  return withTenantContext(db, tenantId, async () => {
    const rows = await db
      .select()
      .from(deletionRequests)
      .where(eq(deletionRequests.tenantId, tenantId))
      .orderBy(desc(deletionRequests.requestedAt))
      .limit(100);

    return rows.map((row) => serializeDeletionRequest(row));
  });
}

export async function processDeletionRequest(
  db: Database,
  tenantId: string,
  requestId: string,
  action: 'complete' | 'reject',
) {
  return withTenantContext(db, tenantId, async () => {
    const [request] = await db
      .select()
      .from(deletionRequests)
      .where(and(eq(deletionRequests.id, requestId), eq(deletionRequests.tenantId, tenantId)))
      .limit(1);

    if (!request) throw notFound('Deletion request not found');
    if (request.status !== 'pending' && request.status !== 'processing') {
      throw notFound('Deletion request is no longer pending');
    }

    const nextStatus: DeletionRequestStatus = action === 'complete' ? 'completed' : 'rejected';
    const completedAt = new Date();

    if (action === 'complete') {
      await db
        .update(users)
        .set({
          email: `deleted-${request.userId}@anonymized.local`,
          name: null,
          timezone: null,
          updatedAt: completedAt,
        })
        .where(eq(users.id, request.userId));

      await db
        .update(tenantMemberships)
        .set({ deletedAt: completedAt, updatedAt: completedAt })
        .where(
          and(
            eq(tenantMemberships.tenantId, tenantId),
            eq(tenantMemberships.userId, request.userId),
            isNull(tenantMemberships.deletedAt),
          ),
        );

      await db
        .delete(notificationPreferences)
        .where(
          and(
            eq(notificationPreferences.tenantId, tenantId),
            eq(notificationPreferences.userId, request.userId),
          ),
        );

      await db
        .update(notifications)
        .set({
          title: 'Notification removed',
          body: '',
          metadata: {},
        })
        .where(
          and(eq(notifications.tenantId, tenantId), eq(notifications.userId, request.userId)),
        );
    }

    const [updated] = await db
      .update(deletionRequests)
      .set({
        status: nextStatus,
        completedAt,
        updatedAt: completedAt,
      })
      .where(eq(deletionRequests.id, requestId))
      .returning();

    return updated ? serializeDeletionRequest(updated) : null;
  });
}

export async function getTenantFeatureFlags(db: Database, tenantId: string) {
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  return (tenant?.featureFlags ?? {}) as Record<string, unknown>;
}

export async function updateTenantFeatureFlags(
  db: Database,
  tenantId: string,
  input: Record<string, unknown>,
) {
  const current = await getTenantFeatureFlags(db, tenantId);
  const next = { ...current, ...input };
  await db
    .update(tenants)
    .set({ featureFlags: next, updatedAt: new Date() })
    .where(eq(tenants.id, tenantId));
  return next;
}
