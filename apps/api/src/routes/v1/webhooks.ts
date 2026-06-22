import { mapJiraWebhookToEvent } from '@beacon/shared/events';
import { createDb } from '@beacon/db';
import { Hono } from 'hono';
import { env } from '../../env.js';
import { badRequest, forbidden, problemResponse, unauthorized } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import {
  verifyJiraWebhookRequest,
  verifySlackRequestSignature,
} from '../../services/webhooks/inbound-verification.js';
import { publishEvent } from '../../services/events/ingest.js';
import { syncClerkMembership, syncClerkOrganization } from '../../services/tenant-service.js';

export const webhookRoutes = new Hono();

interface ClerkWebhookEvent {
  type: string;
  data: Record<string, unknown>;
}

webhookRoutes.post('/webhooks/clerk', async (c) => {
  const payload = await c.req.text();
  const headers = {
    'svix-id': c.req.header('svix-id') ?? '',
    'svix-timestamp': c.req.header('svix-timestamp') ?? '',
    'svix-signature': c.req.header('svix-signature') ?? '',
  };

  let event: ClerkWebhookEvent;

  if (env.CLERK_WEBHOOK_SECRET) {
    const { Webhook } = await import('svix');
    const wh = new Webhook(env.CLERK_WEBHOOK_SECRET);
    event = wh.verify(payload, headers) as ClerkWebhookEvent;
  } else if (env.AUTH_DEV_MODE) {
    event = JSON.parse(payload) as ClerkWebhookEvent;
  } else {
    return problemResponse(c, unauthorized());
  }

  const { db } = createDb(env.DATABASE_URL);

  try {
    switch (event.type) {
      case 'organization.created': {
        const org = event.data;
        const createdBy = org.created_by as string | undefined;
        if (!createdBy) break;

        await syncClerkOrganization(db, {
          externalOrgId: String(org.id),
          name: String(org.name ?? 'Organization'),
          adminExternalAuthId: createdBy,
          adminEmail: `${createdBy}@clerk.beacon.test`,
          adminName: null,
        });
        break;
      }
      case 'organizationMembership.created': {
        const membership = event.data;
        const orgId = (membership.organization as { id?: string } | undefined)?.id;
        const publicUser = membership.public_user_data as
          | { user_id?: string; identifier?: string; first_name?: string }
          | undefined;

        if (!orgId || !publicUser?.user_id) break;

        await syncClerkMembership(db, {
          externalOrgId: orgId,
          externalAuthId: publicUser.user_id,
          email: publicUser.identifier ?? `${publicUser.user_id}@clerk.beacon.test`,
          name: publicUser.first_name ?? null,
        });
        break;
      }
      default:
        logger.info('Unhandled Clerk webhook event', { type: event.type });
    }
  } catch (error) {
    logger.error('Clerk webhook processing failed', {
      type: event.type,
      message: error instanceof Error ? error.message : String(error),
    });
    return problemResponse(c, badRequest('Webhook processing failed'));
  }

  return c.json({ received: true });
});

webhookRoutes.post('/webhooks/jira', async (c) => {
  const rawBody = await c.req.text();
  let payload: {
    webhookEvent?: string;
    issue?: { id?: string; fields?: { project?: { id?: string } } };
    matchedWebhookIds?: string[];
  };

  try {
    payload = JSON.parse(rawBody) as typeof payload;
  } catch {
    return problemResponse(c, badRequest('Invalid Jira webhook payload'));
  }

  if (!payload?.webhookEvent) {
    return problemResponse(c, badRequest('Invalid Jira webhook payload'));
  }

  if (!env.AUTH_DEV_MODE) {
    if (!env.JIRA_WEBHOOK_SECRET) {
      return problemResponse(c, forbidden('Jira webhook signing is not configured'));
    }

    const verified = verifyJiraWebhookRequest({
      configuredSecret: env.JIRA_WEBHOOK_SECRET,
      providedSecret:
        c.req.query('secret') ??
        c.req.header('x-beacon-webhook-secret') ??
        c.req.header('authorization')?.replace(/^Bearer\s+/i, ''),
      rawBody,
      signature: c.req.header('x-hub-signature-256') ?? c.req.header('x-hub-signature'),
    });

    if (!verified) {
      return problemResponse(c, forbidden('Jira webhook verification failed'));
    }
  }

  const tenantId = c.req.header('x-tenant-id');
  if (!tenantId) {
    logger.info('Jira webhook received without tenant context', { event: payload.webhookEvent });
    return c.json({ received: true, queued: false });
  }

  try {
    const canonicalEvent = mapJiraWebhookToEvent({
      tenantId,
      webhookEvent: payload.webhookEvent,
      issue: payload.issue as Parameters<typeof mapJiraWebhookToEvent>[0]['issue'],
    });
    const result = await publishEvent(canonicalEvent, 'realtime');
    logger.info('Jira webhook enqueued event', {
      tenantId,
      event: payload.webhookEvent,
      issueId: payload.issue?.id,
      jobId: result.jobId,
    });
    return c.json({
      received: true,
      queued: result.queued,
      jobId: result.jobId,
      externalEventId: result.externalEventId,
    });
  } catch (error) {
    logger.error('Failed to enqueue Jira webhook event', {
      message: error instanceof Error ? error.message : String(error),
    });
    return problemResponse(c, badRequest('Failed to enqueue webhook event'));
  }
});

webhookRoutes.post('/webhooks/slack', async (c) => {
  const rawBody = await c.req.text();
  let payload: {
    type?: string;
    challenge?: string;
    event?: {
      type?: string;
      channel?: string;
      user?: string;
      text?: string;
      ts?: string;
      thread_ts?: string;
    };
  };

  try {
    payload = JSON.parse(rawBody) as typeof payload;
  } catch {
    return problemResponse(c, badRequest('Invalid Slack webhook payload'));
  }

  if (payload.type === 'url_verification' && payload.challenge) {
    return c.json({ challenge: payload.challenge });
  }

  if (!env.AUTH_DEV_MODE) {
    if (!env.SLACK_SIGNING_SECRET) {
      return problemResponse(c, forbidden('Slack webhook signing is not configured'));
    }

    const valid = verifySlackRequestSignature(
      env.SLACK_SIGNING_SECRET,
      rawBody,
      c.req.header('x-slack-request-timestamp'),
      c.req.header('x-slack-signature'),
    );
    if (!valid) {
      return problemResponse(c, forbidden('Slack webhook verification failed'));
    }
  } else if (env.SLACK_SIGNING_SECRET) {
    const valid = verifySlackRequestSignature(
      env.SLACK_SIGNING_SECRET,
      rawBody,
      c.req.header('x-slack-request-timestamp'),
      c.req.header('x-slack-signature'),
    );
    if (!valid) {
      return problemResponse(c, forbidden('Slack webhook verification failed'));
    }
  }

  const tenantId = c.req.header('x-tenant-id');
  if (!tenantId || payload.event?.type !== 'message' || !payload.event.channel || !payload.event.ts) {
    return c.json({ received: true, queued: false });
  }

  try {
    const { buildSlackMessageEvent } = await import('@beacon/shared/events');
    const { getSlackChannelMappingByChannelId } = await import(
      '../../services/slack/integration-service.js'
    );
    const { db } = createDb(env.DATABASE_URL);
    const mapping = await getSlackChannelMappingByChannelId(db, tenantId, payload.event.channel);
    if (!mapping?.mapping) {
      return c.json({ received: true, queued: false });
    }

    const event = buildSlackMessageEvent({
      tenantId,
      projectId: mapping.mapping.internalId,
      channelId: payload.event.channel,
      messageTs: payload.event.ts,
      sourceUpdatedAt: new Date(Number(payload.event.ts.split('.')[0]) * 1000).toISOString(),
      payload: {
        channelId: payload.event.channel,
        messageTs: payload.event.ts,
        userId: payload.event.user,
        threadTs: payload.event.thread_ts ?? null,
        previewRedacted: true,
      },
    });
    const result = await publishEvent(event, 'realtime');
    return c.json({
      received: true,
      queued: result.queued,
      jobId: result.jobId,
      externalEventId: result.externalEventId,
    });
  } catch (error) {
    logger.error('Failed to enqueue Slack webhook event', {
      message: error instanceof Error ? error.message : String(error),
    });
    return problemResponse(c, badRequest('Failed to enqueue Slack webhook event'));
  }
});
