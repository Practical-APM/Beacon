import {
  projects,
  webhookSubscriptions,
  withTenantContext,
  type Database,
} from '@beacon/db';
import {
  buildOutboundWebhookPayload,
  matchesWebhookEventFilter,
  type OutboundRiskWebhookInput,
} from '@beacon/shared/outbound-webhooks';
import { and, eq } from 'drizzle-orm';
import { logger } from '../../lib/logger.js';
import { getResolvedFeatureFlags } from '../feature-flags.js';
import {
  createWebhookDeliveryRecord,
  incrementWebhookDeliveryAttempt,
  markWebhookDeliveryFailure,
  markWebhookDeliverySuccess,
} from './subscription-service.js';
import { buildWebhookSignatureHeaders, truncateResponseBody } from './signing.js';

const MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [0, 1000, 3000];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function deliverToSubscription(
  db: Database,
  tenantId: string,
  subscription: typeof webhookSubscriptions.$inferSelect,
  payload: ReturnType<typeof buildOutboundWebhookPayload>,
): Promise<void> {
  const deliveryId = await createWebhookDeliveryRecord(db, tenantId, subscription.id, payload);
  const headers = buildWebhookSignatureHeaders(subscription.secret, payload);

  let lastError = 'Delivery failed';
  let lastStatus: number | null = null;
  let lastBody = '';

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    await incrementWebhookDeliveryAttempt(db, tenantId, deliveryId);
    if (RETRY_DELAYS_MS[attempt]) {
      await sleep(RETRY_DELAYS_MS[attempt]!);
    }

    try {
      const response = await fetch(subscription.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10_000),
      });
      lastStatus = response.status;
      lastBody = truncateResponseBody(await response.text().catch(() => ''));

      if (response.ok) {
        await markWebhookDeliverySuccess(
          db,
          tenantId,
          deliveryId,
          subscription.id,
          response.status,
          lastBody,
        );
        return;
      }

      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Network error';
      lastStatus = null;
    }
  }

  await markWebhookDeliveryFailure(
    db,
    tenantId,
    deliveryId,
    subscription.id,
    lastStatus,
    lastError,
    lastBody || undefined,
  );
  logger.warn('Outbound webhook delivery failed', {
    tenantId,
    subscriptionId: subscription.id,
    eventType: payload.type,
    error: lastError,
  });
}

export async function dispatchOutboundRiskWebhooks(
  db: Database,
  tenantId: string,
  events: OutboundRiskWebhookInput[],
): Promise<void> {
  if (events.length === 0) return;

  const flags = await getResolvedFeatureFlags(db, tenantId);
  if (!flags.outboundWebhooksEnabled) return;

  const subscriptions = await withTenantContext(db, tenantId, async () =>
    db
      .select()
      .from(webhookSubscriptions)
      .where(and(eq(webhookSubscriptions.tenantId, tenantId), eq(webhookSubscriptions.enabled, true))),
  );
  if (subscriptions.length === 0) return;

  const projectNames = new Map<string, string>();
  const projectIds = [...new Set(events.map((event) => event.projectId))];
  if (projectIds.length > 0) {
    await withTenantContext(db, tenantId, async () => {
      const rows = await db
        .select({ id: projects.id, name: projects.name })
        .from(projects)
        .where(and(eq(projects.tenantId, tenantId)));
      for (const row of rows) {
        projectNames.set(row.id, row.name);
      }
    });
  }

  for (const event of events) {
    const payload = buildOutboundWebhookPayload({
      ...event,
      projectName: event.projectName ?? projectNames.get(event.projectId) ?? null,
    });

    for (const subscription of subscriptions) {
      if (!matchesWebhookEventFilter(subscription.eventTypes, payload.type)) continue;
      await deliverToSubscription(db, tenantId, subscription, payload);
    }
  }
}

export async function sendWebhookTestPing(
  db: Database,
  tenantId: string,
  subscriptionId: string,
): Promise<{ delivered: boolean; error?: string }> {
  const subscription = await withTenantContext(db, tenantId, async () => {
    const [row] = await db
      .select()
      .from(webhookSubscriptions)
      .where(and(eq(webhookSubscriptions.id, subscriptionId), eq(webhookSubscriptions.tenantId, tenantId)))
      .limit(1);
    return row ?? null;
  });
  if (!subscription) {
    return { delivered: false, error: 'Subscription not found' };
  }

  const payload = buildOutboundWebhookPayload({
    type: 'ping',
    tenantId,
    subscriptionId,
  });

  try {
    await deliverToSubscription(db, tenantId, subscription, payload);
    return { delivered: true };
  } catch (error) {
    return {
      delivered: false,
      error: error instanceof Error ? error.message : 'Test delivery failed',
    };
  }
}

export function scheduleOutboundRiskWebhooks(
  db: Database,
  tenantId: string,
  events: OutboundRiskWebhookInput[],
): void {
  void dispatchOutboundRiskWebhooks(db, tenantId, events).catch((error) => {
    logger.error('Outbound webhook dispatch failed', {
      tenantId,
      error: error instanceof Error ? error.message : String(error),
    });
  });
}
