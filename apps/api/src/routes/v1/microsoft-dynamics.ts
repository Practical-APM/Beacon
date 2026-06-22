import { createDb } from '@beacon/db';
import { buildDynamicsAuthorizeUrl, validateDynamicsFieldMappings } from '@beacon/shared';
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
import { runDynamicsMappingHealthCheck } from '../../services/dynamics/field-mapping-rails.js';
import {
  disconnectDynamics,
  getDynamicsIntegration,
  readIntegrationMetadata,
  upsertDynamicsIntegration,
} from '../../services/dynamics/integration-service.js';
import { createMockCredentials } from '../../services/dynamics/mock-data.js';
import {
  buildDefaultMetadata,
  exchangeAuthorizationCode,
} from '../../services/dynamics/oauth.js';
import {
  getDynamicsStatus,
  runDynamicsSync,
  startDynamicsSync,
} from '../../services/dynamics/sync.js';

export const microsoftDynamicsRoutes = new Hono();

microsoftDynamicsRoutes.get(
  '/integrations/microsoft-dynamics/connect-url',
  requireAuth,
  requireRole('admin'),
  async (c) => {
    if (!env.DYNAMICS_ENABLED) {
      return c.json(
        buildOAuthConnectResponse({
          enabled: false,
          devMessage: 'Dynamics 365 OAuth is not configured. Use mock connect in development.',
          prodMessage: 'Dynamics 365 OAuth is not configured. Contact your administrator.',
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
      'microsoft_dynamics',
    );

    const connectUrl = buildDynamicsAuthorizeUrl({
      clientId: env.DYNAMICS_CLIENT_ID!,
      redirectUri: env.DYNAMICS_REDIRECT_URI,
      state,
      tenantId: env.DYNAMICS_TENANT_ID,
    });

    return c.json({ connectUrl, mockMode: false });
  },
);

microsoftDynamicsRoutes.get('/integrations/microsoft-dynamics/callback', async (c) => {
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
  const oauthState = await consumeOAuthState(state, 'microsoft_dynamics');
  if (!oauthState?.tenantId) {
    return c.redirect(`${env.WEB_APP_URL}/integrations?error=invalid_oauth_state`);
  }

  if (!env.DYNAMICS_ENABLED) {
    return c.redirect(`${env.WEB_APP_URL}/integrations?error=dynamics_not_configured`);
  }

  try {
    const credentials = await exchangeAuthorizationCode({
      code,
      clientId: env.DYNAMICS_CLIENT_ID!,
      clientSecret: env.DYNAMICS_CLIENT_SECRET!,
      redirectUri: env.DYNAMICS_REDIRECT_URI,
      azureTenantId: env.DYNAMICS_TENANT_ID,
    });

    const metadata = buildDefaultMetadata(credentials.orgUrl, credentials.orgId);
    const { db } = createDb(env.DATABASE_URL);
    const existing = await getDynamicsIntegration(db, oauthState.tenantId);
    const orgChange = detectExternalOrgChange({
      previousOrgId: existing?.externalOrgId,
      nextOrgId: credentials.orgId,
      wasConnected: existing?.status !== 'disconnected' && Boolean(existing),
    });

    await upsertDynamicsIntegration(db, oauthState.tenantId, {
      credentials,
      metadata,
      status: 'connected',
    });
    await runDynamicsMappingHealthCheck(db, oauthState.tenantId);
    await advanceSetup(db, oauthState.tenantId);

    if (orgChange.changed && orgChange.previousOrgId) {
      void notifyAdminsIntegrationOrgChange(db, oauthState.tenantId, {
        source: 'microsoft_dynamics',
        sourceLabel: 'Dynamics 365',
        previousOrgId: orgChange.previousOrgId,
        newOrgId: credentials.orgId,
      }).catch(() => undefined);
    }

    await recordAuditEvent(db, {
      tenantId: oauthState.tenantId,
      userId: oauthState.userId ?? null,
      action: 'integration_connected',
      resourceType: 'integration',
      resourceId: 'microsoft_dynamics',
      metadata: {
        source: 'microsoft_dynamics',
        orgChanged: orgChange.changed,
        previousOrgId: orgChange.previousOrgId,
        newOrgId: credentials.orgId,
      },
      ...auditContextFromRequest(c),
    });

    const redirectParams = new URLSearchParams({ connected: 'microsoft_dynamics' });
    if (orgChange.changed) {
      redirectParams.set('org_changed', '1');
    }

    return c.redirect(`${env.WEB_APP_URL}/integrations/setup?${redirectParams.toString()}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'oauth_failed';
    return c.redirect(`${env.WEB_APP_URL}/integrations?error=${encodeURIComponent(message)}`);
  }
});

microsoftDynamicsRoutes.post(
  '/integrations/microsoft-dynamics/mock-connect',
  requireAuth,
  requireRole('admin'),
  async (c) => {
    if (!env.AUTH_DEV_MODE) {
      return problemResponse(c, badRequest('Mock connect is only available in development mode'));
    }

    const auth = getAuth(c);
    const body = (await c.req.json().catch(() => ({}))) as { orgId?: string };
    const credentials = createMockCredentials(
      typeof body.orgId === 'string' && body.orgId.trim() ? body.orgId.trim() : undefined,
    );
    const metadata = buildDefaultMetadata(credentials.orgUrl, credentials.orgId);
    const { db } = createDb(env.DATABASE_URL);
    const existing = await getDynamicsIntegration(db, auth.tenantId);
    const orgChange = detectExternalOrgChange({
      previousOrgId: existing?.externalOrgId,
      nextOrgId: credentials.orgId,
      wasConnected: existing?.status !== 'disconnected' && Boolean(existing),
    });

    const integration = await upsertDynamicsIntegration(db, auth.tenantId, {
      credentials,
      metadata,
      status: 'connected',
    });
    await runDynamicsMappingHealthCheck(db, auth.tenantId);
    await advanceSetup(db, auth.tenantId);

    if (orgChange.changed && orgChange.previousOrgId) {
      void notifyAdminsIntegrationOrgChange(db, auth.tenantId, {
        source: 'microsoft_dynamics',
        sourceLabel: 'Dynamics 365',
        previousOrgId: orgChange.previousOrgId,
        newOrgId: credentials.orgId,
      }).catch(() => undefined);
    }

    await recordAuditEvent(db, {
      tenantId: auth.tenantId,
      userId: auth.userId,
      action: 'integration_connected',
      resourceType: 'integration',
      resourceId: integration.id,
      metadata: {
        source: 'microsoft_dynamics',
        mock: true,
        orgChanged: orgChange.changed,
        previousOrgId: orgChange.previousOrgId,
        newOrgId: credentials.orgId,
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

microsoftDynamicsRoutes.get(
  '/integrations/microsoft-dynamics/status',
  requireAuth,
  requireRole('operational'),
  async (c) => {
    const auth = getAuth(c);
    const { db } = createDb(env.DATABASE_URL);
    const status = await getDynamicsStatus(db, auth.tenantId);
    return c.json(status);
  },
);

microsoftDynamicsRoutes.post(
  '/integrations/microsoft-dynamics/sync',
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

    const integration = await getDynamicsIntegration(db, auth.tenantId);
    if (!integration || integration.status === 'disconnected') {
      return problemResponse(c, badRequest('Connect Dynamics 365 before syncing'));
    }

    const metadata = readIntegrationMetadata(integration);
    await runDynamicsMappingHealthCheck(db, auth.tenantId);
    const { complete, missing } = validateDynamicsFieldMappings(metadata.fieldMappings);
    if (!complete) {
      return problemResponse(
        c,
        badRequest(`Incomplete field mappings: ${missing.join(', ')}`),
      );
    }

    if (body.async) {
      startDynamicsSync(db, auth.tenantId, jobType);
      return c.json({ status: 'started', jobType }, 202);
    }

    try {
      const result = await runDynamicsSync(db, auth.tenantId, jobType);
      return c.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sync failed';
      return problemResponse(c, badRequest(message));
    }
  },
);

microsoftDynamicsRoutes.delete(
  '/integrations/microsoft-dynamics/disconnect',
  requireAuth,
  requireRole('admin'),
  async (c) => {
    const auth = getAuth(c);
    const { db } = createDb(env.DATABASE_URL);
    await disconnectDynamics(db, auth.tenantId);
    await recordAuditEvent(db, {
      tenantId: auth.tenantId,
      userId: auth.userId,
      action: 'integration_disconnected',
      resourceType: 'integration',
      resourceId: 'microsoft_dynamics',
      metadata: { source: 'microsoft_dynamics' },
      ...auditContextFromRequest(c),
    });
    return c.body(null, 204);
  },
);
