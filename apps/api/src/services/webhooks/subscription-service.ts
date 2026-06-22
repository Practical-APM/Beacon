import {
  webhookDeliveries,
  webhookSubscriptions,
  withTenantContext,
  type Database,
} from '@beacon/db';
import {
  DEFAULT_OUTBOUND_WEBHOOK_EVENT_TYPES,
  buildOutboundWebhookPayload,
  sanitizeWebhookUrl,
  type OutboundRiskWebhookInput,
  type OutboundWebhookEventType,
} from '@beacon/shared/outbound-webhooks';
import { and, desc, eq } from 'drizzle-orm';
import { generateWebhookSecret } from './signing.js';

const MAX_CONSECUTIVE_FAILURES = 10;

export interface WebhookSubscriptionRecord {
  id: string;
  tenantId: string;
  url: string;
  description: string | null;
  enabled: boolean;
  eventTypes: string[];
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  consecutiveFailures: number;
  createdAt: string;
  updatedAt: string;
}

function serializeSubscription(row: typeof webhookSubscriptions.$inferSelect): WebhookSubscriptionRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    url: row.url,
    description: row.description,
    enabled: row.enabled,
    eventTypes: row.eventTypes ?? DEFAULT_OUTBOUND_WEBHOOK_EVENT_TYPES,
    lastSuccessAt: row.lastSuccessAt?.toISOString() ?? null,
    lastFailureAt: row.lastFailureAt?.toISOString() ?? null,
    consecutiveFailures: row.consecutiveFailures,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function normalizeEventTypes(eventTypes: string[] | undefined): OutboundWebhookEventType[] {
  const allowed = new Set<string>(DEFAULT_OUTBOUND_WEBHOOK_EVENT_TYPES);
  const filtered = (eventTypes ?? DEFAULT_OUTBOUND_WEBHOOK_EVENT_TYPES).filter((type) =>
    allowed.has(type),
  );
  return (filtered.length > 0 ? filtered : DEFAULT_OUTBOUND_WEBHOOK_EVENT_TYPES) as OutboundWebhookEventType[];
}

export async function listWebhookSubscriptions(
  db: Database,
  tenantId: string,
): Promise<WebhookSubscriptionRecord[]> {
  return withTenantContext(db, tenantId, async () => {
    const rows = await db
      .select()
      .from(webhookSubscriptions)
      .where(eq(webhookSubscriptions.tenantId, tenantId))
      .orderBy(desc(webhookSubscriptions.createdAt));
    return rows.map(serializeSubscription);
  });
}

export async function createWebhookSubscription(
  db: Database,
  tenantId: string,
  input: { url: string; description?: string; eventTypes?: string[] },
): Promise<{ subscription: WebhookSubscriptionRecord; secret: string }> {
  const sanitizedUrl = sanitizeWebhookUrl(input.url);
  if (!sanitizedUrl) {
    throw new Error('Invalid webhook URL. Use HTTPS in production or localhost for development.');
  }

  const secret = generateWebhookSecret();
  const eventTypes = normalizeEventTypes(input.eventTypes);

  return withTenantContext(db, tenantId, async () => {
    const [row] = await db
      .insert(webhookSubscriptions)
      .values({
        tenantId,
        url: sanitizedUrl,
        secret,
        description: input.description ?? null,
        eventTypes,
      })
      .returning();
    return { subscription: serializeSubscription(row!), secret };
  });
}

export async function updateWebhookSubscription(
  db: Database,
  tenantId: string,
  subscriptionId: string,
  input: { url?: string; description?: string | null; enabled?: boolean; eventTypes?: string[] },
): Promise<WebhookSubscriptionRecord | null> {
  return withTenantContext(db, tenantId, async () => {
    const [existing] = await db
      .select()
      .from(webhookSubscriptions)
      .where(and(eq(webhookSubscriptions.id, subscriptionId), eq(webhookSubscriptions.tenantId, tenantId)))
      .limit(1);
    if (!existing) return null;

    const nextUrl = input.url ? sanitizeWebhookUrl(input.url) : existing.url;
    if (input.url && !nextUrl) {
      throw new Error('Invalid webhook URL. Use HTTPS in production or localhost for development.');
    }

    const [row] = await db
      .update(webhookSubscriptions)
      .set({
        url: nextUrl ?? existing.url,
        description: input.description === undefined ? existing.description : input.description,
        enabled: input.enabled ?? existing.enabled,
        eventTypes: input.eventTypes ? normalizeEventTypes(input.eventTypes) : existing.eventTypes,
        updatedAt: new Date(),
      })
      .where(eq(webhookSubscriptions.id, subscriptionId))
      .returning();

    return row ? serializeSubscription(row) : null;
  });
}

export async function deleteWebhookSubscription(
  db: Database,
  tenantId: string,
  subscriptionId: string,
): Promise<boolean> {
  return withTenantContext(db, tenantId, async () => {
    const deleted = await db
      .delete(webhookSubscriptions)
      .where(and(eq(webhookSubscriptions.id, subscriptionId), eq(webhookSubscriptions.tenantId, tenantId)))
      .returning({ id: webhookSubscriptions.id });
    return deleted.length > 0;
  });
}

export async function getWebhookSubscriptionWithSecret(
  db: Database,
  tenantId: string,
  subscriptionId: string,
): Promise<(typeof webhookSubscriptions.$inferSelect) | null> {
  return withTenantContext(db, tenantId, async () => {
    const [row] = await db
      .select()
      .from(webhookSubscriptions)
      .where(and(eq(webhookSubscriptions.id, subscriptionId), eq(webhookSubscriptions.tenantId, tenantId)))
      .limit(1);
    return row ?? null;
  });
}

export async function listWebhookDeliveries(
  db: Database,
  tenantId: string,
  limit = 50,
): Promise<Array<{
  id: string;
  subscriptionId: string;
  eventType: string;
  eventId: string;
  status: string;
  attemptCount: number;
  responseStatus: number | null;
  errorMessage: string | null;
  deliveredAt: string | null;
  createdAt: string;
}>> {
  return withTenantContext(db, tenantId, async () => {
    const rows = await db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.tenantId, tenantId))
      .orderBy(desc(webhookDeliveries.createdAt))
      .limit(limit);

    return rows.map((row) => ({
      id: row.id,
      subscriptionId: row.subscriptionId,
      eventType: row.eventType,
      eventId: row.eventId,
      status: row.status,
      attemptCount: row.attemptCount,
      responseStatus: row.responseStatus,
      errorMessage: row.errorMessage,
      deliveredAt: row.deliveredAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    }));
  });
}

export async function rotateWebhookSubscriptionSecret(
  db: Database,
  tenantId: string,
  subscriptionId: string,
): Promise<{ secret: string } | null> {
  const secret = generateWebhookSecret();
  return withTenantContext(db, tenantId, async () => {
    const [row] = await db
      .update(webhookSubscriptions)
      .set({ secret, updatedAt: new Date() })
      .where(and(eq(webhookSubscriptions.id, subscriptionId), eq(webhookSubscriptions.tenantId, tenantId)))
      .returning({ id: webhookSubscriptions.id });
    return row ? { secret } : null;
  });
}

export async function markWebhookDeliverySuccess(
  db: Database,
  tenantId: string,
  deliveryId: string,
  subscriptionId: string,
  responseStatus: number,
  responseBody: string,
): Promise<void> {
  await withTenantContext(db, tenantId, async () => {
    await db
      .update(webhookDeliveries)
      .set({
        status: 'delivered',
        responseStatus,
        responseBody,
        deliveredAt: new Date(),
      })
      .where(eq(webhookDeliveries.id, deliveryId));

    await db
      .update(webhookSubscriptions)
      .set({
        lastSuccessAt: new Date(),
        consecutiveFailures: 0,
        updatedAt: new Date(),
      })
      .where(eq(webhookSubscriptions.id, subscriptionId));
  });
}

export async function markWebhookDeliveryFailure(
  db: Database,
  tenantId: string,
  deliveryId: string,
  subscriptionId: string,
  responseStatus: number | null,
  errorMessage: string,
  responseBody?: string,
): Promise<void> {
  await withTenantContext(db, tenantId, async () => {
    const [subscription] = await db
      .select()
      .from(webhookSubscriptions)
      .where(eq(webhookSubscriptions.id, subscriptionId))
      .limit(1);
    if (!subscription) return;

    const consecutiveFailures = subscription.consecutiveFailures + 1;
    await db
      .update(webhookDeliveries)
      .set({
        status: 'failed',
        responseStatus,
        responseBody: responseBody ?? null,
        errorMessage,
      })
      .where(eq(webhookDeliveries.id, deliveryId));

    await db
      .update(webhookSubscriptions)
      .set({
        lastFailureAt: new Date(),
        consecutiveFailures,
        enabled: consecutiveFailures >= MAX_CONSECUTIVE_FAILURES ? false : subscription.enabled,
        updatedAt: new Date(),
      })
      .where(eq(webhookSubscriptions.id, subscriptionId));
  });
}

export async function createWebhookDeliveryRecord(
  db: Database,
  tenantId: string,
  subscriptionId: string,
  payload: ReturnType<typeof buildOutboundWebhookPayload>,
): Promise<string> {
  return withTenantContext(db, tenantId, async () => {
    const [row] = await db
      .insert(webhookDeliveries)
      .values({
        tenantId,
        subscriptionId,
        eventType: payload.type,
        eventId: payload.id,
        payload: payload as unknown as Record<string, unknown>,
        attemptCount: 0,
      })
      .returning({ id: webhookDeliveries.id });
    return row!.id;
  });
}

export async function incrementWebhookDeliveryAttempt(
  db: Database,
  tenantId: string,
  deliveryId: string,
): Promise<void> {
  await withTenantContext(db, tenantId, async () => {
    const [row] = await db
      .select({ attemptCount: webhookDeliveries.attemptCount })
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.id, deliveryId))
      .limit(1);
    if (!row) return;
    await db
      .update(webhookDeliveries)
      .set({ attemptCount: row.attemptCount + 1 })
      .where(eq(webhookDeliveries.id, deliveryId));
  });
}

export type { OutboundRiskWebhookInput };
