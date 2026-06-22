import { createDb, projects, withTenantContext } from '@beacon/db';
import { suggestProjectMappings } from '@beacon/shared';
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
  disconnectLinear,
  getLinearIntegration,
  readLinearMetadata,
  upsertLinearIntegration,
  upsertLinearTeamMapping,
} from '../../services/linear/integration-service.js';
import { createMockLinearCredentials } from '../../services/linear/mock-data.js';
import {
  buildDefaultLinearMetadata,
  buildLinearOAuthUrl,
  exchangeLinearAuthorizationCode,
} from '../../services/linear/oauth.js';
import {
  ensureDefaultMockLinearMapping,
  getLinearStatus,
  listAvailableLinearTeams,
  runLinearSync,
  startLinearSync,
} from '../../services/linear/sync.js';

const mappingSchema = z.object({
  beaconProjectId: z.string().uuid(),
  linearTeamId: z.string().min(1),
  linearTeamKey: z.string().optional(),
  linearTeamName: z.string().optional(),
});

export const linearRoutes = new Hono();

linearRoutes.get('/integrations/linear/connect-url', requireAuth, requireRole('admin'), async (c) => {
  if (!env.LINEAR_ENABLED) {
    return c.json(
      buildOAuthConnectResponse({
        enabled: false,
        devMessage: 'Linear OAuth is not configured. Use mock connect in development.',
        prodMessage: 'Linear OAuth is not configured. Contact your administrator.',
      }),
    );
  }

  const auth = getAuth(c);
  const state = randomBytes(24).toString('hex');
  await storeOAuthState(state, { tenantId: auth.tenantId, userId: auth.userId }, 'linear');

  const connectUrl = buildLinearOAuthUrl({
    clientId: env.LINEAR_CLIENT_ID!,
    redirectUri: env.LINEAR_REDIRECT_URI,
    state,
  });

  return c.json({ connectUrl, mockMode: false });
});

linearRoutes.get('/integrations/linear/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const error = c.req.query('error');

  if (error) {
    return c.redirect(`${env.WEB_APP_URL}/integrations?linear_error=${encodeURIComponent(error)}`);
  }
  if (!code || !state) {
    return c.redirect(`${env.WEB_APP_URL}/integrations?linear_error=missing_oauth_params`);
  }

  const { consumeOAuthState } = await import('../../lib/sync-lock.js');
  const oauthState = await consumeOAuthState(state, 'linear');
  if (!oauthState?.tenantId) {
    return c.redirect(`${env.WEB_APP_URL}/integrations?linear_error=invalid_oauth_state`);
  }
  if (!env.LINEAR_ENABLED) {
    return c.redirect(`${env.WEB_APP_URL}/integrations?linear_error=linear_not_configured`);
  }

  try {
    const credentials = await exchangeLinearAuthorizationCode({
      code,
      clientId: env.LINEAR_CLIENT_ID!,
      clientSecret: env.LINEAR_CLIENT_SECRET!,
      redirectUri: env.LINEAR_REDIRECT_URI,
    });
    const metadata = buildDefaultLinearMetadata(
      credentials.organizationId,
      credentials.organizationName,
    );
    const { db } = createDb(env.DATABASE_URL);
    const integration = await upsertLinearIntegration(db, oauthState.tenantId, {
      credentials,
      metadata,
      status: 'connected',
    });
    await ensureDefaultMockLinearMapping(db, oauthState.tenantId, integration.id);
    await advanceSetup(db, oauthState.tenantId);
    await recordAuditEvent(db, {
      tenantId: oauthState.tenantId,
      userId: oauthState.userId ?? null,
      action: 'integration_connected',
      resourceType: 'integration',
      resourceId: 'linear',
      metadata: { source: 'linear' },
      ...auditContextFromRequest(c),
    });
    return c.redirect(`${env.WEB_APP_URL}/integrations/setup?linear_connected=1`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'oauth_failed';
    return c.redirect(`${env.WEB_APP_URL}/integrations?linear_error=${encodeURIComponent(message)}`);
  }
});

linearRoutes.post('/integrations/linear/mock-connect', requireAuth, requireRole('admin'), async (c) => {
  if (!env.AUTH_DEV_MODE) {
    return problemResponse(c, badRequest('Mock connect is only available in development mode'));
  }

  const auth = getAuth(c);
  const credentials = createMockLinearCredentials();
  const metadata = buildDefaultLinearMetadata(
    credentials.organizationId,
    credentials.organizationName,
  );
  const { db } = createDb(env.DATABASE_URL);
  const integration = await upsertLinearIntegration(db, auth.tenantId, {
    credentials,
    metadata,
    status: 'connected',
  });
  await ensureDefaultMockLinearMapping(db, auth.tenantId, integration.id);
  await advanceSetup(db, auth.tenantId);
  await recordAuditEvent(db, {
    tenantId: auth.tenantId,
    userId: auth.userId,
    action: 'integration_connected',
    resourceType: 'integration',
    resourceId: integration.id,
    metadata: { source: 'linear', mock: true },
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

linearRoutes.get('/integrations/linear/status', requireAuth, requireRole('operational'), async (c) => {
  const auth = getAuth(c);
  const { db } = createDb(env.DATABASE_URL);
  const status = await getLinearStatus(db, auth.tenantId);
  return c.json(status);
});

linearRoutes.get('/integrations/linear/teams', requireAuth, requireRole('operational'), async (c) => {
  const auth = getAuth(c);
  const { db } = createDb(env.DATABASE_URL);
  const integration = await getLinearIntegration(db, auth.tenantId);
  if (!integration || integration.status === 'disconnected') {
    return problemResponse(c, badRequest('Connect Linear before listing teams'));
  }

  const teams = await listAvailableLinearTeams(db, auth.tenantId);
  const beaconProjects = await withTenantContext(db, auth.tenantId, async () =>
    db
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(and(eq(projects.tenantId, auth.tenantId), isNull(projects.deletedAt))),
  );

  const suggestions = suggestProjectMappings(
    teams.map((team) => ({ id: team.id, key: team.key, name: team.name })),
    beaconProjects,
  ).map((item) => ({
    linearTeamId: item.jiraProjectId,
    linearTeamName: item.jiraProjectName,
    suggestedProjectId: item.suggestedProjectId,
    suggestedProjectName: item.suggestedProjectName,
    confidence: item.confidence,
  }));

  return c.json({ teams, suggestions });
});

linearRoutes.post('/integrations/linear/team-mappings', requireAuth, requireRole('admin'), async (c) => {
  const auth = getAuth(c);
  const body = mappingSchema.safeParse(await c.req.json());
  if (!body.success) return problemResponse(c, badRequest(body.error.message));

  const { db } = createDb(env.DATABASE_URL);
  const integration = await getLinearIntegration(db, auth.tenantId);
  if (!integration) return problemResponse(c, badRequest('Connect Linear before creating mappings'));

  const mapping = await upsertLinearTeamMapping(db, auth.tenantId, integration.id, {
    internalId: body.data.beaconProjectId,
    externalId: body.data.linearTeamId,
    metadata: {
      linearTeamKey: body.data.linearTeamKey,
      linearTeamName: body.data.linearTeamName,
    },
  });

  await recordAuditEvent(db, {
    tenantId: auth.tenantId,
    userId: auth.userId,
    action: 'integration_mapping_updated',
    resourceType: 'integration_mapping',
    resourceId: mapping.id,
    metadata: {
      source: 'linear',
      beaconProjectId: body.data.beaconProjectId,
      linearTeamId: body.data.linearTeamId,
    },
    ...auditContextFromRequest(c),
  });

  return c.json({ mapping });
});

linearRoutes.post('/integrations/linear/sync', requireAuth, requireRole('admin'), async (c) => {
  const auth = getAuth(c);
  const body = (await c.req.json().catch(() => ({}))) as {
    jobType?: 'bulk' | 'incremental';
    async?: boolean;
  };
  const jobType = body.jobType === 'incremental' ? 'incremental' : 'bulk';
  const { db } = createDb(env.DATABASE_URL);

  const integration = await getLinearIntegration(db, auth.tenantId);
  if (!integration || integration.status === 'disconnected') {
    return problemResponse(c, badRequest('Connect Linear before syncing'));
  }

  if (body.async) {
    startLinearSync(db, auth.tenantId, jobType);
    return c.json({ status: 'started', jobType }, 202);
  }

  try {
    const result = await runLinearSync(db, auth.tenantId, jobType);
    return c.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Sync failed';
    return problemResponse(c, badRequest(message));
  }
});

linearRoutes.delete('/integrations/linear/disconnect', requireAuth, requireRole('admin'), async (c) => {
  const auth = getAuth(c);
  const { db } = createDb(env.DATABASE_URL);
  await disconnectLinear(db, auth.tenantId);
  await recordAuditEvent(db, {
    tenantId: auth.tenantId,
    userId: auth.userId,
    action: 'integration_disconnected',
    resourceType: 'integration',
    resourceId: 'linear',
    metadata: { source: 'linear' },
    ...auditContextFromRequest(c),
  });
  return c.body(null, 204);
});

linearRoutes.get('/integrations/linear/metadata', requireAuth, requireRole('operational'), async (c) => {
  const auth = getAuth(c);
  const { db } = createDb(env.DATABASE_URL);
  const integration = await getLinearIntegration(db, auth.tenantId);
  if (!integration) return c.json({ metadata: null });
  return c.json({ metadata: readLinearMetadata(integration) });
});
