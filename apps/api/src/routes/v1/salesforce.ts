import { createDb } from '@beacon/db';
import {
  DEFAULT_IMPLEMENTATION_STAGES,
  validateFieldMappings,
  type SalesforceEnvironment,
  type SalesforceFieldMappings,
} from '@beacon/shared';
import { randomBytes } from 'node:crypto';
import { Hono } from 'hono';
import { z } from 'zod';
import { env } from '../../env.js';
import { badRequest, problemResponse } from '../../lib/errors.js';
import { buildOAuthConnectResponse } from '../../lib/mock-integration.js';
import { storeOAuthState } from '../../lib/sync-lock.js';
import { getAuth, requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { auditContextFromRequest, recordAuditEvent } from '../../services/audit/audit-service.js';
import {
  disconnectSalesforce,
  getSalesforceIntegration,
  readIntegrationMetadata,
  updateSalesforceMetadata,
  upsertSalesforceIntegration,
} from '../../services/salesforce/integration-service.js';
import { createMockCredentials } from '../../services/salesforce/mock-data.js';
import {
  buildDefaultMetadata,
  buildOAuthUrl,
  exchangeAuthorizationCode,
  mergeFieldMappings,
} from '../../services/salesforce/oauth.js';
import { runSalesforceMappingHealthCheck } from '../../services/salesforce/field-mapping-rails.js';
import { advanceSetup } from '../../services/integrations/setup-orchestrator.js';
import {
  detectExternalOrgChange,
  notifyAdminsIntegrationOrgChange,
} from '../../services/integrations/org-change.js';
import { getSalesforceStatus, runSalesforceSync, startSalesforceSync } from '../../services/salesforce/sync.js';

const environmentSchema = z.enum(['production', 'sandbox']);
const mappingsSchema = z.object({
  fieldMappings: z.record(z.string()).optional(),
  implementationStages: z.array(z.string().min(1)).optional(),
});

export const salesforceRoutes = new Hono();

salesforceRoutes.get(
  '/integrations/salesforce/connect-url',
  requireAuth,
  requireRole('admin'),
  async (c) => {
    if (!env.SALESFORCE_ENABLED) {
      return c.json(
        buildOAuthConnectResponse({
          enabled: false,
          devMessage: 'Salesforce OAuth is not configured. Use mock connect in development.',
          prodMessage: 'Salesforce OAuth is not configured. Contact your administrator.',
        }),
      );
    }

    const parsed = environmentSchema.safeParse(c.req.query('environment') ?? 'sandbox');
    if (!parsed.success) {
      return problemResponse(c, badRequest('environment must be production or sandbox'));
    }

    const auth = getAuth(c);
    const state = randomBytes(24).toString('hex');
    await storeOAuthState(state, {
      tenantId: auth.tenantId,
      userId: auth.userId,
      environment: parsed.data,
    });

    const connectUrl = buildOAuthUrl({
      clientId: env.SALESFORCE_CLIENT_ID!,
      redirectUri: env.SALESFORCE_REDIRECT_URI,
      state,
      environment: parsed.data,
    });

    return c.json({ connectUrl, environment: parsed.data, mockMode: false });
  },
);

salesforceRoutes.get('/integrations/salesforce/callback', async (c) => {
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
  const oauthState = await consumeOAuthState(state, 'salesforce');
  if (!oauthState?.tenantId || !oauthState.environment) {
    return c.redirect(`${env.WEB_APP_URL}/integrations?error=invalid_oauth_state`);
  }

  if (!env.SALESFORCE_ENABLED) {
    return c.redirect(`${env.WEB_APP_URL}/integrations?error=salesforce_not_configured`);
  }

  try {
    const credentials = await exchangeAuthorizationCode({
      code,
      clientId: env.SALESFORCE_CLIENT_ID!,
      clientSecret: env.SALESFORCE_CLIENT_SECRET!,
      redirectUri: env.SALESFORCE_REDIRECT_URI,
      environment: oauthState.environment as SalesforceEnvironment,
    });

    const metadata = buildDefaultMetadata(
      credentials.environment,
      credentials.instanceUrl,
      credentials.orgId,
    );

    const { db } = createDb(env.DATABASE_URL);
    const existing = await getSalesforceIntegration(db, oauthState.tenantId);
    const orgChange = detectExternalOrgChange({
      previousOrgId: existing?.externalOrgId,
      nextOrgId: credentials.orgId,
      wasConnected: existing?.status !== 'disconnected' && Boolean(existing),
    });

    await upsertSalesforceIntegration(db, oauthState.tenantId, {
      credentials,
      metadata,
      status: 'connected',
    });
    await runSalesforceMappingHealthCheck(db, oauthState.tenantId);
    await advanceSetup(db, oauthState.tenantId);

    if (orgChange.changed && orgChange.previousOrgId) {
      void notifyAdminsIntegrationOrgChange(db, oauthState.tenantId, {
        source: 'salesforce',
        sourceLabel: 'Salesforce',
        previousOrgId: orgChange.previousOrgId,
        newOrgId: credentials.orgId,
      }).catch(() => undefined);
    }

    await recordAuditEvent(db, {
      tenantId: oauthState.tenantId,
      userId: oauthState.userId ?? null,
      action: 'integration_connected',
      resourceType: 'integration',
      resourceId: 'salesforce',
      metadata: {
        source: 'salesforce',
        orgChanged: orgChange.changed,
        previousOrgId: orgChange.previousOrgId,
        newOrgId: credentials.orgId,
      },
      ...auditContextFromRequest(c),
    });

    const redirectParams = new URLSearchParams({ connected: 'salesforce' });
    if (orgChange.changed) {
      redirectParams.set('org_changed', '1');
    }

    return c.redirect(`${env.WEB_APP_URL}/integrations/setup?${redirectParams.toString()}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'oauth_failed';
    return c.redirect(`${env.WEB_APP_URL}/integrations?error=${encodeURIComponent(message)}`);
  }
});

salesforceRoutes.post(
  '/integrations/salesforce/mock-connect',
  requireAuth,
  requireRole('admin'),
  async (c) => {
    if (!env.AUTH_DEV_MODE) {
      return problemResponse(c, badRequest('Mock connect is only available in development mode'));
    }

    const parsed = environmentSchema.safeParse((await c.req.json().catch(() => ({}))).environment ?? 'sandbox');
    const environment = parsed.success ? parsed.data : 'sandbox';
    const auth = getAuth(c);
    const credentials = createMockCredentials(undefined, environment);

    const metadata = buildDefaultMetadata(environment, credentials.instanceUrl, credentials.orgId);
    const { db } = createDb(env.DATABASE_URL);
    const existing = await getSalesforceIntegration(db, auth.tenantId);
    const orgChange = detectExternalOrgChange({
      previousOrgId: existing?.externalOrgId,
      nextOrgId: credentials.orgId,
      wasConnected: existing?.status !== 'disconnected' && Boolean(existing),
    });

    const integration = await upsertSalesforceIntegration(db, auth.tenantId, {
      credentials,
      metadata,
      status: 'connected',
    });
    await runSalesforceMappingHealthCheck(db, auth.tenantId);
    await advanceSetup(db, auth.tenantId);

    if (orgChange.changed && orgChange.previousOrgId) {
      void notifyAdminsIntegrationOrgChange(db, auth.tenantId, {
        source: 'salesforce',
        sourceLabel: 'Salesforce',
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
        source: 'salesforce',
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

salesforceRoutes.get(
  '/integrations/salesforce/status',
  requireAuth,
  requireRole('operational'),
  async (c) => {
    const auth = getAuth(c);
    const { db } = createDb(env.DATABASE_URL);
    const status = await getSalesforceStatus(db, auth.tenantId);
    return c.json(status);
  },
);

salesforceRoutes.post(
  '/integrations/salesforce/sync',
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

    const integration = await getSalesforceIntegration(db, auth.tenantId);
    if (!integration || integration.status === 'disconnected') {
      return problemResponse(c, badRequest('Connect Salesforce before syncing'));
    }

    const metadata = readIntegrationMetadata(integration);
    await runSalesforceMappingHealthCheck(db, auth.tenantId);
    const refreshed = await getSalesforceIntegration(db, auth.tenantId);
    const latestMetadata = refreshed ? readIntegrationMetadata(refreshed) : metadata;
    const { complete, missing } = validateFieldMappings(latestMetadata.fieldMappings);
    if (!complete) {
      return problemResponse(
        c,
        badRequest(`Incomplete field mappings: ${missing.join(', ')}`),
      );
    }

    if (body.async) {
      startSalesforceSync(db, auth.tenantId, jobType);
      return c.json({ status: 'started', jobType }, 202);
    }

    try {
      const result = await runSalesforceSync(db, auth.tenantId, jobType);
      return c.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sync failed';
      return problemResponse(c, badRequest(message));
    }
  },
);

salesforceRoutes.patch(
  '/integrations/salesforce/mappings',
  requireAuth,
  requireRole('admin'),
  async (c) => {
    const auth = getAuth(c);
    const body = mappingsSchema.safeParse(await c.req.json());
    if (!body.success) {
      return problemResponse(c, badRequest(body.error.message));
    }

    const { db } = createDb(env.DATABASE_URL);
    const integration = await getSalesforceIntegration(db, auth.tenantId);
    if (!integration) {
      return problemResponse(c, badRequest('Connect Salesforce before updating mappings'));
    }

    const current = readIntegrationMetadata(integration);
    const metadata = mergeFieldMappings(
      current,
      (body.data.fieldMappings ?? {}) as Partial<SalesforceFieldMappings>,
    );
    if (body.data.implementationStages?.length) {
      metadata.implementationStages = body.data.implementationStages;
    }

    const updated = await updateSalesforceMetadata(db, auth.tenantId, metadata);
    await recordAuditEvent(db, {
      tenantId: auth.tenantId,
      userId: auth.userId,
      action: 'integration_mapping_updated',
      resourceType: 'integration',
      resourceId: integration.id,
      metadata: { source: 'salesforce', fieldMappings: metadata.fieldMappings },
      ...auditContextFromRequest(c),
    });
    return c.json({ metadata: updated });
  },
);

salesforceRoutes.delete(
  '/integrations/salesforce/disconnect',
  requireAuth,
  requireRole('admin'),
  async (c) => {
    const auth = getAuth(c);
    const { db } = createDb(env.DATABASE_URL);
    await disconnectSalesforce(db, auth.tenantId);
    await recordAuditEvent(db, {
      tenantId: auth.tenantId,
      userId: auth.userId,
      action: 'integration_disconnected',
      resourceType: 'integration',
      resourceId: 'salesforce',
      metadata: { source: 'salesforce' },
      ...auditContextFromRequest(c),
    });
    return c.body(null, 204);
  },
);

salesforceRoutes.get(
  '/integrations/salesforce/defaults',
  requireAuth,
  requireRole('operational'),
  async (c) => {
    return c.json({
      implementationStages: DEFAULT_IMPLEMENTATION_STAGES,
    });
  },
);
