import { createDb } from '@beacon/db';
import { validateHubSpotFieldMappings } from '@beacon/shared';
import { randomBytes } from 'node:crypto';
import { Hono } from 'hono';
import { env } from '../../env.js';
import { badRequest, problemResponse } from '../../lib/errors.js';
import { buildOAuthConnectResponse } from '../../lib/mock-integration.js';
import { storeOAuthState } from '../../lib/sync-lock.js';
import { getAuth, requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { auditContextFromRequest, recordAuditEvent } from '../../services/audit/audit-service.js';
import { advanceSetup } from '../../services/integrations/setup-orchestrator.js';
import {
  detectExternalOrgChange,
  notifyAdminsIntegrationOrgChange,
} from '../../services/integrations/org-change.js';
import { runHubSpotMappingHealthCheck } from '../../services/hubspot/field-mapping-rails.js';
import {
  disconnectHubSpot,
  getHubSpotIntegration,
  readIntegrationMetadata,
  upsertHubSpotIntegration,
} from '../../services/hubspot/integration-service.js';
import { createMockCredentials } from '../../services/hubspot/mock-data.js';
import {
  buildDefaultMetadata,
  buildOAuthUrl,
  exchangeAuthorizationCode,
} from '../../services/hubspot/oauth.js';
import { getHubSpotStatus, runHubSpotSync, startHubSpotSync } from '../../services/hubspot/sync.js';

export const hubspotRoutes = new Hono();

hubspotRoutes.get(
  '/integrations/hubspot/connect-url',
  requireAuth,
  requireRole('admin'),
  async (c) => {
    if (!env.HUBSPOT_ENABLED) {
      return c.json(
        buildOAuthConnectResponse({
          enabled: false,
          devMessage: 'HubSpot OAuth is not configured. Use mock connect in development.',
          prodMessage: 'HubSpot OAuth is not configured. Contact your administrator.',
        }),
      );
    }

    const auth = getAuth(c);
    const state = randomBytes(24).toString('hex');
    await storeOAuthState(
      state,
      {
        tenantId: auth.tenantId,
        userId: auth.userId,
      },
      'hubspot',
    );

    const connectUrl = buildOAuthUrl({
      clientId: env.HUBSPOT_CLIENT_ID!,
      redirectUri: env.HUBSPOT_REDIRECT_URI,
      state,
    });

    return c.json({ connectUrl, mockMode: false });
  },
);

hubspotRoutes.get('/integrations/hubspot/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const error = c.req.query('error');

  if (error) {
    return c.redirect(`${env.WEB_APP_URL}/integrations?error=${encodeURIComponent(error)}`);
  }

  if (!code || !state) {
    return c.redirect(`${env.WEB_APP_URL}/integrations?error=missing_oauth_params`);
  }

  const { consumeOAuthState } = await import('../../lib/sync-lock.js');
  const oauthState = await consumeOAuthState(state, 'hubspot');
  if (!oauthState?.tenantId) {
    return c.redirect(`${env.WEB_APP_URL}/integrations?error=invalid_oauth_state`);
  }

  if (!env.HUBSPOT_ENABLED) {
    return c.redirect(`${env.WEB_APP_URL}/integrations?error=hubspot_not_configured`);
  }

  try {
    const credentials = await exchangeAuthorizationCode({
      code,
      clientId: env.HUBSPOT_CLIENT_ID!,
      clientSecret: env.HUBSPOT_CLIENT_SECRET!,
      redirectUri: env.HUBSPOT_REDIRECT_URI,
    });

    const metadata = buildDefaultMetadata(credentials.portalId);
    const { db } = createDb(env.DATABASE_URL);
    const existing = await getHubSpotIntegration(db, oauthState.tenantId);
    const orgChange = detectExternalOrgChange({
      previousOrgId: existing?.externalOrgId,
      nextOrgId: credentials.portalId,
      wasConnected: existing?.status !== 'disconnected' && Boolean(existing),
    });

    await upsertHubSpotIntegration(db, oauthState.tenantId, {
      credentials,
      metadata,
      status: 'connected',
    });
    await runHubSpotMappingHealthCheck(db, oauthState.tenantId);
    await advanceSetup(db, oauthState.tenantId);

    if (orgChange.changed && orgChange.previousOrgId) {
      void notifyAdminsIntegrationOrgChange(db, oauthState.tenantId, {
        source: 'hubspot',
        sourceLabel: 'HubSpot',
        previousOrgId: orgChange.previousOrgId,
        newOrgId: credentials.portalId,
      }).catch(() => undefined);
    }

    await recordAuditEvent(db, {
      tenantId: oauthState.tenantId,
      userId: oauthState.userId ?? null,
      action: 'integration_connected',
      resourceType: 'integration',
      resourceId: 'hubspot',
      metadata: {
        source: 'hubspot',
        orgChanged: orgChange.changed,
        previousOrgId: orgChange.previousOrgId,
        newOrgId: credentials.portalId,
      },
      ...auditContextFromRequest(c),
    });

    const redirectParams = new URLSearchParams({ connected: 'hubspot' });
    if (orgChange.changed) {
      redirectParams.set('org_changed', '1');
    }

    return c.redirect(`${env.WEB_APP_URL}/integrations/setup?${redirectParams.toString()}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'oauth_failed';
    return c.redirect(`${env.WEB_APP_URL}/integrations?error=${encodeURIComponent(message)}`);
  }
});

hubspotRoutes.post(
  '/integrations/hubspot/mock-connect',
  requireAuth,
  requireRole('admin'),
  async (c) => {
    if (!env.AUTH_DEV_MODE) {
      return problemResponse(c, badRequest('Mock connect is only available in development mode'));
    }

    const auth = getAuth(c);
    const body = (await c.req.json().catch(() => ({}))) as { portalId?: string };
    const credentials = createMockCredentials(
      typeof body.portalId === 'string' && body.portalId.trim()
        ? body.portalId.trim()
        : undefined,
    );
    const metadata = buildDefaultMetadata(credentials.portalId);
    const { db } = createDb(env.DATABASE_URL);
    const existing = await getHubSpotIntegration(db, auth.tenantId);
    const orgChange = detectExternalOrgChange({
      previousOrgId: existing?.externalOrgId,
      nextOrgId: credentials.portalId,
      wasConnected: existing?.status !== 'disconnected' && Boolean(existing),
    });

    const integration = await upsertHubSpotIntegration(db, auth.tenantId, {
      credentials,
      metadata,
      status: 'connected',
    });
    await runHubSpotMappingHealthCheck(db, auth.tenantId);
    await advanceSetup(db, auth.tenantId);

    if (orgChange.changed && orgChange.previousOrgId) {
      void notifyAdminsIntegrationOrgChange(db, auth.tenantId, {
        source: 'hubspot',
        sourceLabel: 'HubSpot',
        previousOrgId: orgChange.previousOrgId,
        newOrgId: credentials.portalId,
      }).catch(() => undefined);
    }

    await recordAuditEvent(db, {
      tenantId: auth.tenantId,
      userId: auth.userId,
      action: 'integration_connected',
      resourceType: 'integration',
      resourceId: integration.id,
      metadata: {
        source: 'hubspot',
        mock: true,
        orgChanged: orgChange.changed,
        previousOrgId: orgChange.previousOrgId,
        newOrgId: credentials.portalId,
      },
      ...auditContextFromRequest(c),
    });

    return c.json({
      integration: {
        id: integration.id,
        source: integration.source,
        status: integration.status,
        metadata,
      },
      orgChanged: orgChange.changed,
    });
  },
);

hubspotRoutes.get(
  '/integrations/hubspot/status',
  requireAuth,
  requireRole('operational'),
  async (c) => {
    const auth = getAuth(c);
    const { db } = createDb(env.DATABASE_URL);
    const status = await getHubSpotStatus(db, auth.tenantId);
    return c.json(status);
  },
);

hubspotRoutes.post(
  '/integrations/hubspot/sync',
  requireAuth,
  requireRole('admin'),
  async (c) => {
    const auth = getAuth(c);
    const body = (await c.req.json().catch(() => ({}))) as {
      jobType?: 'bulk' | 'incremental';
      async?: boolean;
    };
    const jobType = body.jobType === 'incremental' ? 'incremental' : 'bulk';
    const { db } = createDb(env.DATABASE_URL);

    const integration = await getHubSpotIntegration(db, auth.tenantId);
    if (!integration || integration.status === 'disconnected') {
      return problemResponse(c, badRequest('Connect HubSpot before syncing'));
    }

    const metadata = readIntegrationMetadata(integration);
    await runHubSpotMappingHealthCheck(db, auth.tenantId);
    const { complete, missing } = validateHubSpotFieldMappings(metadata.fieldMappings);
    if (!complete) {
      return problemResponse(
        c,
        badRequest(`Incomplete field mappings: ${missing.join(', ')}`),
      );
    }

    if (body.async) {
      startHubSpotSync(db, auth.tenantId, jobType);
      return c.json({ status: 'started', jobType }, 202);
    }

    try {
      const result = await runHubSpotSync(db, auth.tenantId, jobType);
      return c.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sync failed';
      return problemResponse(c, badRequest(message));
    }
  },
);

hubspotRoutes.delete(
  '/integrations/hubspot/disconnect',
  requireAuth,
  requireRole('admin'),
  async (c) => {
    const auth = getAuth(c);
    const { db } = createDb(env.DATABASE_URL);
    await disconnectHubSpot(db, auth.tenantId);
    await recordAuditEvent(db, {
      tenantId: auth.tenantId,
      userId: auth.userId,
      action: 'integration_disconnected',
      resourceType: 'integration',
      resourceId: 'hubspot',
      metadata: { source: 'hubspot' },
      ...auditContextFromRequest(c),
    });
    return c.body(null, 204);
  },
);
