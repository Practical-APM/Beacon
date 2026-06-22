import { createDb } from '@beacon/db';
import { validatePipedriveFieldMappings } from '@beacon/shared';
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
import { runPipedriveMappingHealthCheck } from '../../services/pipedrive/field-mapping-rails.js';
import {
  disconnectPipedrive,
  getPipedriveIntegration,
  readIntegrationMetadata,
  upsertPipedriveIntegration,
} from '../../services/pipedrive/integration-service.js';
import { createMockCredentials } from '../../services/pipedrive/mock-data.js';
import {
  buildDefaultMetadata,
  buildOAuthUrl,
  exchangeAuthorizationCode,
} from '../../services/pipedrive/oauth.js';
import { getPipedriveStatus, runPipedriveSync, startPipedriveSync } from '../../services/pipedrive/sync.js';

export const pipedriveRoutes = new Hono();

pipedriveRoutes.get(
  '/integrations/pipedrive/connect-url',
  requireAuth,
  requireRole('admin'),
  async (c) => {
    if (!env.PIPEDRIVE_ENABLED) {
      return c.json(
        buildOAuthConnectResponse({
          enabled: false,
          devMessage: 'Pipedrive OAuth is not configured. Use mock connect in development.',
          prodMessage: 'Pipedrive OAuth is not configured. Contact your administrator.',
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
      'pipedrive',
    );

    const connectUrl = buildOAuthUrl({
      clientId: env.PIPEDRIVE_CLIENT_ID!,
      redirectUri: env.PIPEDRIVE_REDIRECT_URI,
      state,
    });

    return c.json({ connectUrl, mockMode: false });
  },
);

pipedriveRoutes.get('/integrations/pipedrive/callback', async (c) => {
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
  const oauthState = await consumeOAuthState(state, 'pipedrive');
  if (!oauthState?.tenantId) {
    return c.redirect(`${env.WEB_APP_URL}/integrations?error=invalid_oauth_state`);
  }

  if (!env.PIPEDRIVE_ENABLED) {
    return c.redirect(`${env.WEB_APP_URL}/integrations?error=pipedrive_not_configured`);
  }

  try {
    const credentials = await exchangeAuthorizationCode({
      code,
      clientId: env.PIPEDRIVE_CLIENT_ID!,
      clientSecret: env.PIPEDRIVE_CLIENT_SECRET!,
      redirectUri: env.PIPEDRIVE_REDIRECT_URI,
    });

    const metadata = buildDefaultMetadata(credentials.companyId, credentials.apiDomain);
    const { db } = createDb(env.DATABASE_URL);
    const existing = await getPipedriveIntegration(db, oauthState.tenantId);
    const orgChange = detectExternalOrgChange({
      previousOrgId: existing?.externalOrgId,
      nextOrgId: credentials.companyId,
      wasConnected: existing?.status !== 'disconnected' && Boolean(existing),
    });

    await upsertPipedriveIntegration(db, oauthState.tenantId, {
      credentials,
      metadata,
      status: 'connected',
    });
    await runPipedriveMappingHealthCheck(db, oauthState.tenantId);
    await advanceSetup(db, oauthState.tenantId);

    if (orgChange.changed && orgChange.previousOrgId) {
      void notifyAdminsIntegrationOrgChange(db, oauthState.tenantId, {
        source: 'pipedrive',
        sourceLabel: 'Pipedrive',
        previousOrgId: orgChange.previousOrgId,
        newOrgId: credentials.companyId,
      }).catch(() => undefined);
    }

    await recordAuditEvent(db, {
      tenantId: oauthState.tenantId,
      userId: oauthState.userId ?? null,
      action: 'integration_connected',
      resourceType: 'integration',
      resourceId: 'pipedrive',
      metadata: {
        source: 'pipedrive',
        orgChanged: orgChange.changed,
        previousOrgId: orgChange.previousOrgId,
        newOrgId: credentials.companyId,
      },
      ...auditContextFromRequest(c),
    });

    const redirectParams = new URLSearchParams({ connected: 'pipedrive' });
    if (orgChange.changed) {
      redirectParams.set('org_changed', '1');
    }

    return c.redirect(`${env.WEB_APP_URL}/integrations/setup?${redirectParams.toString()}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'oauth_failed';
    return c.redirect(`${env.WEB_APP_URL}/integrations?error=${encodeURIComponent(message)}`);
  }
});

pipedriveRoutes.post(
  '/integrations/pipedrive/mock-connect',
  requireAuth,
  requireRole('admin'),
  async (c) => {
    if (!env.AUTH_DEV_MODE) {
      return problemResponse(c, badRequest('Mock connect is only available in development mode'));
    }

    const auth = getAuth(c);
    const body = (await c.req.json().catch(() => ({}))) as { companyId?: string };
    const credentials = createMockCredentials(
      typeof body.companyId === 'string' && body.companyId.trim()
        ? body.companyId.trim()
        : undefined,
    );
    const metadata = buildDefaultMetadata(credentials.companyId, credentials.apiDomain);
    const { db } = createDb(env.DATABASE_URL);
    const existing = await getPipedriveIntegration(db, auth.tenantId);
    const orgChange = detectExternalOrgChange({
      previousOrgId: existing?.externalOrgId,
      nextOrgId: credentials.companyId,
      wasConnected: existing?.status !== 'disconnected' && Boolean(existing),
    });

    const integration = await upsertPipedriveIntegration(db, auth.tenantId, {
      credentials,
      metadata,
      status: 'connected',
    });
    await runPipedriveMappingHealthCheck(db, auth.tenantId);
    await advanceSetup(db, auth.tenantId);

    if (orgChange.changed && orgChange.previousOrgId) {
      void notifyAdminsIntegrationOrgChange(db, auth.tenantId, {
        source: 'pipedrive',
        sourceLabel: 'Pipedrive',
        previousOrgId: orgChange.previousOrgId,
        newOrgId: credentials.companyId,
      }).catch(() => undefined);
    }

    await recordAuditEvent(db, {
      tenantId: auth.tenantId,
      userId: auth.userId,
      action: 'integration_connected',
      resourceType: 'integration',
      resourceId: integration.id,
      metadata: {
        source: 'pipedrive',
        mock: true,
        orgChanged: orgChange.changed,
        previousOrgId: orgChange.previousOrgId,
        newOrgId: credentials.companyId,
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

pipedriveRoutes.get(
  '/integrations/pipedrive/status',
  requireAuth,
  requireRole('operational'),
  async (c) => {
    const auth = getAuth(c);
    const { db } = createDb(env.DATABASE_URL);
    const status = await getPipedriveStatus(db, auth.tenantId);
    return c.json(status);
  },
);

pipedriveRoutes.post(
  '/integrations/pipedrive/sync',
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

    const integration = await getPipedriveIntegration(db, auth.tenantId);
    if (!integration || integration.status === 'disconnected') {
      return problemResponse(c, badRequest('Connect Pipedrive before syncing'));
    }

    const metadata = readIntegrationMetadata(integration);
    await runPipedriveMappingHealthCheck(db, auth.tenantId);
    const { complete, missing } = validatePipedriveFieldMappings(metadata.fieldMappings);
    if (!complete) {
      return problemResponse(
        c,
        badRequest(`Incomplete field mappings: ${missing.join(', ')}`),
      );
    }

    if (body.async) {
      startPipedriveSync(db, auth.tenantId, jobType);
      return c.json({ status: 'started', jobType }, 202);
    }

    try {
      const result = await runPipedriveSync(db, auth.tenantId, jobType);
      return c.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sync failed';
      return problemResponse(c, badRequest(message));
    }
  },
);

pipedriveRoutes.delete(
  '/integrations/pipedrive/disconnect',
  requireAuth,
  requireRole('admin'),
  async (c) => {
    const auth = getAuth(c);
    const { db } = createDb(env.DATABASE_URL);
    await disconnectPipedrive(db, auth.tenantId);
    await recordAuditEvent(db, {
      tenantId: auth.tenantId,
      userId: auth.userId,
      action: 'integration_disconnected',
      resourceType: 'integration',
      resourceId: 'pipedrive',
      metadata: { source: 'pipedrive' },
      ...auditContextFromRequest(c),
    });
    return c.body(null, 204);
  },
);
