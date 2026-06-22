import { notificationDeliveryLog, withTenantContext, type Database } from '@beacon/db';
import type { NotificationChannel, NotificationType } from '@beacon/shared/notifications';
import { and, eq, gte } from 'drizzle-orm';
import { logger } from '../../lib/logger.js';

const IMMEDIATE_DEBOUNCE_MS = 24 * 60 * 60 * 1000;

export interface DeliveryPayload {
  tenantId: string;
  userId?: string;
  riskId?: string;
  channel: NotificationChannel;
  notificationType: NotificationType;
  dedupeKey: string;
  toEmail?: string;
  subject?: string;
  text?: string;
  html?: string;
  title?: string;
  body?: string;
  metadata?: Record<string, unknown>;
}

export async function wasRecentlyDelivered(
  db: Database,
  tenantId: string,
  dedupeKey: string,
  withinMs = IMMEDIATE_DEBOUNCE_MS,
): Promise<boolean> {
  const since = new Date(Date.now() - withinMs);
  const [row] = await withTenantContext(db, tenantId, async () =>
    db
      .select()
      .from(notificationDeliveryLog)
      .where(
        and(
          eq(notificationDeliveryLog.tenantId, tenantId),
          eq(notificationDeliveryLog.dedupeKey, dedupeKey),
          gte(notificationDeliveryLog.sentAt, since),
        ),
      )
      .limit(1),
  );
  return Boolean(row);
}

export async function recordDelivery(
  db: Database,
  payload: DeliveryPayload,
  status: 'sent' | 'failed' | 'skipped' | 'bounced',
  error?: string,
) {
  await withTenantContext(db, payload.tenantId, async () => {
    await db
      .insert(notificationDeliveryLog)
      .values({
        tenantId: payload.tenantId,
        userId: payload.userId ?? null,
        riskId: payload.riskId ?? null,
        channel: payload.channel,
        notificationType: payload.notificationType,
        dedupeKey: payload.dedupeKey,
        status,
        error: error ?? null,
        metadata: payload.metadata ?? {},
      })
      .onConflictDoNothing({
        target: [notificationDeliveryLog.tenantId, notificationDeliveryLog.dedupeKey],
      });
  });
}

export async function deliverEmail(payload: DeliveryPayload): Promise<'sent' | 'failed' | 'skipped'> {
  if (!payload.toEmail) return 'skipped';

  const { sendEmail } = await import('./email-provider.js');
  return sendEmail({
    to: payload.toEmail,
    subject: payload.subject ?? 'Beacon notification',
    text: payload.text,
    html: payload.html,
  });
}

export async function deliverSlackInternal(payload: DeliveryPayload): Promise<'sent' | 'skipped'> {
  const webhook = process.env.NOTIFICATIONS_INTERNAL_SLACK_WEBHOOK_URL;
  if (!webhook) {
    logger.info('Notification slack (mock)', {
      title: payload.title,
      body: payload.body,
    });
    return 'sent';
  }

  try {
    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: `*${payload.title}*\n${payload.body}` }),
    });
    return 'sent';
  } catch (error) {
    logger.warn('Slack notification failed', {
      message: error instanceof Error ? error.message : String(error),
    });
    return 'skipped';
  }
}

export async function deliverChannels(
  db: Database,
  payload: DeliveryPayload,
  channels: NotificationChannel[],
): Promise<void> {
  if (await wasRecentlyDelivered(db, payload.tenantId, payload.dedupeKey)) {
    await recordDelivery(db, payload, 'skipped', 'deduped');
    return;
  }

  let hadFailure = false;

  for (const channel of channels) {
    if (channel === 'email') {
      const status = await deliverEmail(payload);
      if (status === 'failed') hadFailure = true;
    } else if (channel === 'slack') {
      const { isSlackAlertsEnabled } = await import('../feature-flags.js');
      if (!(await isSlackAlertsEnabled(db, payload.tenantId))) {
        await recordDelivery(db, { ...payload, channel: 'slack' }, 'skipped', 'feature_disabled');
        continue;
      }
      const status = await deliverSlackInternal(payload);
      if (status === 'skipped') hadFailure = true;
    } else if (channel === 'in_app') {
      const { createInAppNotification } = await import('./in-app.js');
      if (payload.userId && payload.title && payload.body) {
        await createInAppNotification(db, {
          tenantId: payload.tenantId,
          userId: payload.userId,
          type: payload.notificationType,
          title: payload.title,
          body: payload.body,
          metadata: payload.metadata,
        });
      }
    }
  }

  await recordDelivery(db, payload, hadFailure ? 'failed' : 'sent');
}
