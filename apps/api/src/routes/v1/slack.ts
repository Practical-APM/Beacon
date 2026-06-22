import { createDb, projects, withTenantContext } from '@beacon/db';
import { suggestChannelMappings } from '@beacon/shared';
import { randomBytes } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { env } from '../../env.js';
import { badRequest, problemResponse } from '../../lib/errors.js';
import { buildOAuthConnectResponse } from '../../lib/mock-integration.js';
import { storeOAuthState } from '../../lib/sync-lock.js';
import { getAuth, requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { auditContextFromRequest, recordAuditEvent } from '../../services/audit/audit-service.js';
import { advanceSetup } from '../../services/integrations/setup-orchestrator.js';
import {
  deleteSlackChannelMapping,
  disconnectSlack,
  getSlackIntegration,
  upsertSlackChannelMapping,
  upsertSlackIntegration,
} from '../../services/slack/integration-service.js';
import { createMockSlackCredentials } from '../../services/slack/mock-data.js';
import {
  buildDefaultSlackMetadata,
  buildSlackOAuthUrl,
  exchangeSlackAuthorizationCode,
} from '../../services/slack/oauth.js';
import {
  ensureDefaultMockMappings,
  getSlackStatus,
  listAvailableSlackChannels,
  runSlackSync,
  startSlackSync,
} from '../../services/slack/sync.js';

const mappingSchema = z.object({
  beaconProjectId: z.string().uuid(),
  channelId: z.string().min(1),
  channelName: z.string().optional(),
  domainOverrides: z.array(z.string()).optional(),
});

export const slackRoutes = new Hono();

slackRoutes.get('/integrations/slack/connect-url', requireAuth, requireRole('admin'), async (c) => {
  if (!env.SLACK_ENABLED) {
    return c.json(
      buildOAuthConnectResponse({
        enabled: false,
        devMessage: 'Slack OAuth is not configured. Use mock connect in development.',
        prodMessage: 'Slack OAuth is not configured. Contact your administrator.',
        extra: {
          scopes: {
            bot: ['channels:history', 'channels:read', 'groups:history', 'groups:read', 'users:read.email', 'chat:write'],
            user: ['identity.basic', 'identity.email'],
          },
        },
      }),
    );
  }

  const auth = getAuth(c);
  const state = randomBytes(24).toString('hex');
  await storeOAuthState(state, { tenantId: auth.tenantId, userId: auth.userId }, 'slack');

  return c.json({
    connectUrl: buildSlackOAuthUrl({
      clientId: env.SLACK_CLIENT_ID!,
      redirectUri: env.SLACK_REDIRECT_URI,
      state,
    }),
    mockMode: false,
  });
});

slackRoutes.get('/integrations/slack/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const error = c.req.query('error');

  if (error) {
    return c.redirect(`${env.WEB_APP_URL}/integrations?slack_error=${encodeURIComponent(error)}`);
  }
  if (!code || !state) {
    return c.redirect(`${env.WEB_APP_URL}/integrations?slack_error=missing_oauth_params`);
  }

  const { consumeOAuthState } = await import('../../lib/sync-lock.js');
  const oauthState = await consumeOAuthState(state, 'slack');
  if (!oauthState?.tenantId) {
    return c.redirect(`${env.WEB_APP_URL}/integrations?slack_error=invalid_oauth_state`);
  }
  if (!env.SLACK_ENABLED) {
    return c.redirect(`${env.WEB_APP_URL}/integrations?slack_error=slack_not_configured`);
  }

  try {
    const credentials = await exchangeSlackAuthorizationCode({
      code,
      clientId: env.SLACK_CLIENT_ID!,
      clientSecret: env.SLACK_CLIENT_SECRET!,
      redirectUri: env.SLACK_REDIRECT_URI,
    });
    const metadata = buildDefaultSlackMetadata(credentials.teamId, credentials.teamName, credentials.botUserId);
    const { db } = createDb(env.DATABASE_URL);
    await upsertSlackIntegration(db, oauthState.tenantId, { credentials, metadata, status: 'connected' });
    await advanceSetup(db, oauthState.tenantId);
    await recordAuditEvent(db, {
      tenantId: oauthState.tenantId,
      userId: oauthState.userId ?? null,
      action: 'integration_connected',
      resourceType: 'integration',
      resourceId: 'slack',
      metadata: { source: 'slack' },
      ...auditContextFromRequest(c),
    });
    return c.redirect(`${env.WEB_APP_URL}/integrations/setup?slack_connected=1`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'oauth_failed';
    return c.redirect(`${env.WEB_APP_URL}/integrations?slack_error=${encodeURIComponent(message)}`);
  }
});

slackRoutes.post('/integrations/slack/mock-connect', requireAuth, requireRole('admin'), async (c) => {
  if (!env.AUTH_DEV_MODE) {
    return problemResponse(c, badRequest('Mock connect is only available in development mode'));
  }

  const auth = getAuth(c);
  const credentials = createMockSlackCredentials();
  const metadata = buildDefaultSlackMetadata(credentials.teamId, credentials.teamName, credentials.botUserId);
  const { db } = createDb(env.DATABASE_URL);
  const integration = await upsertSlackIntegration(db, auth.tenantId, {
    credentials,
    metadata,
    status: 'connected',
  });
  await ensureDefaultMockMappings(db, auth.tenantId, integration.id);
  await advanceSetup(db, auth.tenantId);
  await recordAuditEvent(db, {
    tenantId: auth.tenantId,
    userId: auth.userId,
    action: 'integration_connected',
    resourceType: 'integration',
    resourceId: integration.id,
    metadata: { source: 'slack', mock: true },
    ...auditContextFromRequest(c),
  });

  return c.json({
    integration: {
      id: integration.id,
      source: integration.source,
      status: integration.status,
      metadata,
    },
  });
});

slackRoutes.get('/integrations/slack/status', requireAuth, requireRole('operational'), async (c) => {
  const auth = getAuth(c);
  const { db } = createDb(env.DATABASE_URL);
  const status = await getSlackStatus(db, auth.tenantId);
  return c.json(status);
});

slackRoutes.get('/integrations/slack/channels', requireAuth, requireRole('operational'), async (c) => {
  const auth = getAuth(c);
  const { db } = createDb(env.DATABASE_URL);
  const integration = await getSlackIntegration(db, auth.tenantId);
  if (!integration || integration.status === 'disconnected') {
    return problemResponse(c, badRequest('Connect Slack before listing channels'));
  }

  const channels = await listAvailableSlackChannels(db, auth.tenantId);
  const beaconProjects = await withTenantContext(db, auth.tenantId, async () =>
    db
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(and(eq(projects.tenantId, auth.tenantId), isNull(projects.deletedAt))),
  );

  return c.json({
    channels,
    suggestions: suggestChannelMappings(channels, beaconProjects),
  });
});

slackRoutes.post('/integrations/slack/channel-mappings', requireAuth, requireRole('admin'), async (c) => {
  const auth = getAuth(c);
  const body = mappingSchema.safeParse(await c.req.json());
  if (!body.success) return problemResponse(c, badRequest(body.error.message));

  const { db } = createDb(env.DATABASE_URL);
  const integration = await getSlackIntegration(db, auth.tenantId);
  if (!integration) return problemResponse(c, badRequest('Connect Slack before creating mappings'));

  const mapping = await upsertSlackChannelMapping(db, auth.tenantId, integration.id, {
    internalId: body.data.beaconProjectId,
    externalId: body.data.channelId,
    metadata: {
      channelName: body.data.channelName,
      domainOverrides: body.data.domainOverrides ?? [],
    },
  });
  await recordAuditEvent(db, {
    tenantId: auth.tenantId,
    userId: auth.userId,
    action: 'integration_mapping_updated',
    resourceType: 'integration_mapping',
    resourceId: mapping.id,
    metadata: { source: 'slack', beaconProjectId: body.data.beaconProjectId, channelId: body.data.channelId },
    ...auditContextFromRequest(c),
  });

  return c.json({ mapping });
});

slackRoutes.delete(
  '/integrations/slack/channel-mappings/:mappingId',
  requireAuth,
  requireRole('admin'),
  async (c) => {
    const auth = getAuth(c);
    const mappingId = c.req.param('mappingId');
    if (!mappingId) return problemResponse(c, badRequest('Missing mappingId'));

    const { db } = createDb(env.DATABASE_URL);
    await deleteSlackChannelMapping(db, auth.tenantId, mappingId);
    return c.body(null, 204);
  },
);

slackRoutes.post('/integrations/slack/sync', requireAuth, requireRole('admin'), async (c) => {
  const auth = getAuth(c);
  const body = (await c.req.json().catch(() => ({}))) as {
    jobType?: 'bulk' | 'incremental';
    async?: boolean;
  };
  const jobType = body.jobType === 'incremental' ? 'incremental' : 'bulk';
  const { db } = createDb(env.DATABASE_URL);

  const integration = await getSlackIntegration(db, auth.tenantId);
  if (!integration || integration.status === 'disconnected') {
    return problemResponse(c, badRequest('Connect Slack before syncing'));
  }

  if (body.async) {
    startSlackSync(db, auth.tenantId, jobType);
    return c.json({ status: 'started', jobType }, 202);
  }

  try {
    const result = await runSlackSync(db, auth.tenantId, jobType);
    return c.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Sync failed';
    return problemResponse(c, badRequest(message));
  }
});

slackRoutes.delete('/integrations/slack/disconnect', requireAuth, requireRole('admin'), async (c) => {
  const auth = getAuth(c);
  const { db } = createDb(env.DATABASE_URL);
  await disconnectSlack(db, auth.tenantId);
  await recordAuditEvent(db, {
    tenantId: auth.tenantId,
    userId: auth.userId,
    action: 'integration_disconnected',
    resourceType: 'integration',
    resourceId: 'slack',
    metadata: { source: 'slack' },
    ...auditContextFromRequest(c),
  });
  return c.body(null, 204);
});
