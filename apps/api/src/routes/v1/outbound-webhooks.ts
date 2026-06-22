import { createDb } from '@beacon/db';
import { Hono } from 'hono';
import { z } from 'zod';
import { env } from '../../env.js';
import { badRequest, notFound, problemResponse } from '../../lib/errors.js';
import { getAuth, requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { auditContextFromRequest, recordAuditEvent } from '../../services/audit/audit-service.js';
import {
  createWebhookSubscription,
  deleteWebhookSubscription,
  listWebhookDeliveries,
  listWebhookSubscriptions,
  rotateWebhookSubscriptionSecret,
  updateWebhookSubscription,
} from '../../services/webhooks/subscription-service.js';
import { sendWebhookTestPing } from '../../services/webhooks/delivery-service.js';

function requireParam(value: string | undefined, name: string): string {
  if (!value) throw new Error(`Missing path parameter: ${name}`);
  return value;
}

const RISK_WEBHOOK_EVENT_TYPES = [
  'risk.created',
  'risk.updated',
  'risk.escalated',
  'risk.resolved',
] as const;

const createSchema = z.object({
  url: z.string().url(),
  description: z.string().max(200).optional(),
  eventTypes: z.array(z.enum(RISK_WEBHOOK_EVENT_TYPES)).optional(),
});

const updateSchema = z.object({
  url: z.string().url().optional(),
  description: z.string().max(200).nullable().optional(),
  enabled: z.boolean().optional(),
  eventTypes: z.array(z.enum(RISK_WEBHOOK_EVENT_TYPES)).optional(),
});

export const outboundWebhookRoutes = new Hono();

outboundWebhookRoutes.get('/admin/webhooks', requireAuth, requireRole('admin'), async (c) => {
  const auth = getAuth(c);
  const { db } = createDb(env.DATABASE_URL);
  const data = await listWebhookSubscriptions(db, auth.tenantId);
  return c.json({ data });
});

outboundWebhookRoutes.post('/admin/webhooks', requireAuth, requireRole('admin'), async (c) => {
  const auth = getAuth(c);
  const body = createSchema.safeParse(await c.req.json());
  if (!body.success) return problemResponse(c, badRequest(body.error.message));

  const { db } = createDb(env.DATABASE_URL);
  try {
    const result = await createWebhookSubscription(db, auth.tenantId, body.data);
    await recordAuditEvent(db, {
      tenantId: auth.tenantId,
      userId: auth.userId,
      action: 'webhook_subscription_created',
      resourceType: 'webhook_subscription',
      resourceId: result.subscription.id,
      metadata: { url: result.subscription.url, eventTypes: result.subscription.eventTypes },
      ...auditContextFromRequest(c),
    });
    return c.json(
      {
        subscription: result.subscription,
        secret: result.secret,
      },
      201,
    );
  } catch (error) {
    return problemResponse(
      c,
      badRequest(error instanceof Error ? error.message : 'Failed to create webhook subscription'),
    );
  }
});

outboundWebhookRoutes.patch('/admin/webhooks/:subscriptionId', requireAuth, requireRole('admin'), async (c) => {
  const auth = getAuth(c);
  const body = updateSchema.safeParse(await c.req.json());
  if (!body.success) return problemResponse(c, badRequest(body.error.message));

  const { db } = createDb(env.DATABASE_URL);
  try {
    const subscription = await updateWebhookSubscription(
      db,
      auth.tenantId,
      requireParam(c.req.param('subscriptionId'), 'subscriptionId'),
      body.data,
    );
    if (!subscription) return problemResponse(c, notFound('Webhook subscription not found'));

    await recordAuditEvent(db, {
      tenantId: auth.tenantId,
      userId: auth.userId,
      action: 'webhook_subscription_updated',
      resourceType: 'webhook_subscription',
      resourceId: subscription.id,
      metadata: body.data,
      ...auditContextFromRequest(c),
    });
    return c.json({ subscription });
  } catch (error) {
    return problemResponse(
      c,
      badRequest(error instanceof Error ? error.message : 'Failed to update webhook subscription'),
    );
  }
});

outboundWebhookRoutes.delete('/admin/webhooks/:subscriptionId', requireAuth, requireRole('admin'), async (c) => {
  const auth = getAuth(c);
  const { db } = createDb(env.DATABASE_URL);
  const deleted = await deleteWebhookSubscription(
    db,
    auth.tenantId,
    requireParam(c.req.param('subscriptionId'), 'subscriptionId'),
  );
  if (!deleted) return problemResponse(c, notFound('Webhook subscription not found'));

  await recordAuditEvent(db, {
    tenantId: auth.tenantId,
    userId: auth.userId,
    action: 'webhook_subscription_deleted',
    resourceType: 'webhook_subscription',
    resourceId: requireParam(c.req.param('subscriptionId'), 'subscriptionId'),
    ...auditContextFromRequest(c),
  });
  return c.body(null, 204);
});

outboundWebhookRoutes.post(
  '/admin/webhooks/:subscriptionId/test',
  requireAuth,
  requireRole('admin'),
  async (c) => {
    const auth = getAuth(c);
    const { db } = createDb(env.DATABASE_URL);
    const result = await sendWebhookTestPing(
      db,
      auth.tenantId,
      requireParam(c.req.param('subscriptionId'), 'subscriptionId'),
    );
    if (!result.delivered && result.error === 'Subscription not found') {
      return problemResponse(c, notFound('Webhook subscription not found'));
    }
    return c.json(result);
  },
);

outboundWebhookRoutes.post(
  '/admin/webhooks/:subscriptionId/rotate-secret',
  requireAuth,
  requireRole('admin'),
  async (c) => {
    const auth = getAuth(c);
    const { db } = createDb(env.DATABASE_URL);
    const result = await rotateWebhookSubscriptionSecret(
      db,
      auth.tenantId,
      requireParam(c.req.param('subscriptionId'), 'subscriptionId'),
    );
    if (!result) return problemResponse(c, notFound('Webhook subscription not found'));
    return c.json(result);
  },
);

outboundWebhookRoutes.get('/admin/webhooks/deliveries', requireAuth, requireRole('admin'), async (c) => {
  const auth = getAuth(c);
  const limit = Number(c.req.query('limit') ?? '50');
  const { db } = createDb(env.DATABASE_URL);
  const data = await listWebhookDeliveries(db, auth.tenantId, limit);
  return c.json({ data });
});
