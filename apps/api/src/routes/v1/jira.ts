import { createDb, projects, withTenantContext } from '@beacon/db';
import { suggestProjectMappings } from '@beacon/shared';
import { randomBytes } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { env } from '../../env.js';
import { badRequest, notFound, problemResponse } from '../../lib/errors.js';
import { buildOAuthConnectResponse } from '../../lib/mock-integration.js';
import { storeOAuthState } from '../../lib/sync-lock.js';
import { getAuth, requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { auditContextFromRequest, recordAuditEvent } from '../../services/audit/audit-service.js';
import {
  disconnectJira,
  getJiraIntegration,
  getProjectTaskDependencies,
  readJiraMetadata,
  upsertJiraIntegration,
  upsertJiraProjectMapping,
} from '../../services/jira/integration-service.js';
import { startGraphRebuild } from '../../services/graph/builder.js';
import { createMockJiraCredentials } from '../../services/jira/mock-data.js';
import {
  buildDefaultJiraMetadata,
  buildJiraOAuthUrl,
  exchangeJiraAuthorizationCode,
} from '../../services/jira/oauth.js';
import { advanceSetup } from '../../services/integrations/setup-orchestrator.js';
import {
  ensureDefaultMockMapping,
  getJiraStatus,
  listAvailableJiraProjects,
  runJiraSync,
  startJiraSync,
} from '../../services/jira/sync.js';

const mappingSchema = z.object({
  beaconProjectId: z.string().uuid(),
  jiraProjectId: z.string().min(1),
  jiraProjectKey: z.string().optional(),
  jiraProjectName: z.string().optional(),
});

export const jiraRoutes = new Hono();

jiraRoutes.get('/integrations/jira/connect-url', requireAuth, requireRole('admin'), async (c) => {
  if (!env.JIRA_ENABLED) {
    return c.json(
      buildOAuthConnectResponse({
        enabled: false,
        devMessage: 'Jira OAuth is not configured. Use mock connect in development.',
        prodMessage: 'Jira OAuth is not configured. Contact your administrator.',
      }),
    );
  }

  const auth = getAuth(c);
  const state = randomBytes(24).toString('hex');
  await storeOAuthState(state, { tenantId: auth.tenantId, userId: auth.userId }, 'jira');

  const connectUrl = buildJiraOAuthUrl({
    clientId: env.JIRA_CLIENT_ID!,
    redirectUri: env.JIRA_REDIRECT_URI,
    state,
  });

  return c.json({ connectUrl, mockMode: false });
});

jiraRoutes.get('/integrations/jira/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const error = c.req.query('error');

  if (error) {
    return c.redirect(`${env.WEB_APP_URL}/integrations?jira_error=${encodeURIComponent(error)}`);
  }
  if (!code || !state) {
    return c.redirect(`${env.WEB_APP_URL}/integrations?jira_error=missing_oauth_params`);
  }

  const { consumeOAuthState } = await import('../../lib/sync-lock.js');
  const oauthState = await consumeOAuthState(state, 'jira');
  if (!oauthState?.tenantId) {
    return c.redirect(`${env.WEB_APP_URL}/integrations?jira_error=invalid_oauth_state`);
  }
  if (!env.JIRA_ENABLED) {
    return c.redirect(`${env.WEB_APP_URL}/integrations?jira_error=jira_not_configured`);
  }

  try {
    const credentials = await exchangeJiraAuthorizationCode({
      code,
      clientId: env.JIRA_CLIENT_ID!,
      clientSecret: env.JIRA_CLIENT_SECRET!,
      redirectUri: env.JIRA_REDIRECT_URI,
    });
    const metadata = buildDefaultJiraMetadata(credentials.cloudId, credentials.siteUrl);
    const { db } = createDb(env.DATABASE_URL);
    await upsertJiraIntegration(db, oauthState.tenantId, { credentials, metadata, status: 'connected' });
    await advanceSetup(db, oauthState.tenantId);
    await recordAuditEvent(db, {
      tenantId: oauthState.tenantId,
      userId: oauthState.userId ?? null,
      action: 'integration_connected',
      resourceType: 'integration',
      resourceId: 'jira',
      metadata: { source: 'jira' },
      ...auditContextFromRequest(c),
    });
    return c.redirect(`${env.WEB_APP_URL}/integrations/setup?jira_connected=1`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'oauth_failed';
    return c.redirect(`${env.WEB_APP_URL}/integrations?jira_error=${encodeURIComponent(message)}`);
  }
});

jiraRoutes.post('/integrations/jira/mock-connect', requireAuth, requireRole('admin'), async (c) => {
  if (!env.AUTH_DEV_MODE) {
    return problemResponse(c, badRequest('Mock connect is only available in development mode'));
  }

  const auth = getAuth(c);
  const credentials = createMockJiraCredentials();
  const metadata = buildDefaultJiraMetadata(credentials.cloudId, credentials.siteUrl);
  const { db } = createDb(env.DATABASE_URL);
  const integration = await upsertJiraIntegration(db, auth.tenantId, {
    credentials,
    metadata,
    status: 'connected',
  });
  await ensureDefaultMockMapping(db, auth.tenantId, integration.id);
  await advanceSetup(db, auth.tenantId);
  await recordAuditEvent(db, {
    tenantId: auth.tenantId,
    userId: auth.userId,
    action: 'integration_connected',
    resourceType: 'integration',
    resourceId: integration.id,
    metadata: { source: 'jira', mock: true },
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

jiraRoutes.get('/integrations/jira/status', requireAuth, requireRole('operational'), async (c) => {
  const auth = getAuth(c);
  const { db } = createDb(env.DATABASE_URL);
  const status = await getJiraStatus(db, auth.tenantId);
  return c.json(status);
});

jiraRoutes.get('/integrations/jira/projects', requireAuth, requireRole('operational'), async (c) => {
  const auth = getAuth(c);
  const { db } = createDb(env.DATABASE_URL);
  const integration = await getJiraIntegration(db, auth.tenantId);
  if (!integration || integration.status === 'disconnected') {
    return problemResponse(c, badRequest('Connect Jira before listing projects'));
  }

  const jiraProjects = await listAvailableJiraProjects(db, auth.tenantId);
  const beaconProjects = await withTenantContext(db, auth.tenantId, async () =>
    db
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(and(eq(projects.tenantId, auth.tenantId), isNull(projects.deletedAt))),
  );

  return c.json({
    projects: jiraProjects,
    suggestions: suggestProjectMappings(jiraProjects, beaconProjects),
  });
});

jiraRoutes.post('/integrations/jira/project-mappings', requireAuth, requireRole('admin'), async (c) => {
  const auth = getAuth(c);
  const body = mappingSchema.safeParse(await c.req.json());
  if (!body.success) return problemResponse(c, badRequest(body.error.message));

  const { db } = createDb(env.DATABASE_URL);
  const integration = await getJiraIntegration(db, auth.tenantId);
  if (!integration) return problemResponse(c, badRequest('Connect Jira before creating mappings'));

  const mapping = await upsertJiraProjectMapping(db, auth.tenantId, integration.id, {
    internalId: body.data.beaconProjectId,
    externalId: body.data.jiraProjectId,
    metadata: {
      jiraProjectKey: body.data.jiraProjectKey,
      jiraProjectName: body.data.jiraProjectName,
    },
  });

  startGraphRebuild(db, auth.tenantId, 'incremental', body.data.beaconProjectId);
  await recordAuditEvent(db, {
    tenantId: auth.tenantId,
    userId: auth.userId,
    action: 'integration_mapping_updated',
    resourceType: 'integration_mapping',
    resourceId: mapping.id,
    metadata: { source: 'jira', beaconProjectId: body.data.beaconProjectId, jiraProjectId: body.data.jiraProjectId },
    ...auditContextFromRequest(c),
  });

  return c.json({ mapping });
});

jiraRoutes.post('/integrations/jira/sync', requireAuth, requireRole('admin'), async (c) => {
  const auth = getAuth(c);
  const body = (await c.req.json().catch(() => ({}))) as {
    jobType?: 'bulk' | 'incremental';
    async?: boolean;
  };
  const jobType = body.jobType === 'incremental' ? 'incremental' : 'bulk';
  const { db } = createDb(env.DATABASE_URL);

  const integration = await getJiraIntegration(db, auth.tenantId);
  if (!integration || integration.status === 'disconnected') {
    return problemResponse(c, badRequest('Connect Jira before syncing'));
  }

  if (body.async) {
    startJiraSync(db, auth.tenantId, jobType);
    return c.json({ status: 'started', jobType }, 202);
  }

  try {
    const result = await runJiraSync(db, auth.tenantId, jobType);
    return c.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Sync failed';
    return problemResponse(c, badRequest(message));
  }
});

jiraRoutes.delete('/integrations/jira/disconnect', requireAuth, requireRole('admin'), async (c) => {
  const auth = getAuth(c);
  const { db } = createDb(env.DATABASE_URL);
  await disconnectJira(db, auth.tenantId);
  await recordAuditEvent(db, {
    tenantId: auth.tenantId,
    userId: auth.userId,
    action: 'integration_disconnected',
    resourceType: 'integration',
    resourceId: 'jira',
    metadata: { source: 'jira' },
    ...auditContextFromRequest(c),
  });
  return c.body(null, 204);
});

jiraRoutes.get(
  '/projects/:projectId/task-dependencies',
  requireAuth,
  requireRole('operational'),
  async (c) => {
    const auth = getAuth(c);
    const projectId = c.req.param('projectId');
    if (!projectId) return problemResponse(c, badRequest('Missing projectId'));

    const { db } = createDb(env.DATABASE_URL);
    const graph = await withTenantContext(db, auth.tenantId, async () => {
      const [project] = await db
        .select()
        .from(projects)
        .where(
          and(eq(projects.id, projectId), eq(projects.tenantId, auth.tenantId), isNull(projects.deletedAt)),
        )
        .limit(1);
      if (!project) return null;
      return getProjectTaskDependencies(db, auth.tenantId, projectId);
    });

    if (!graph) return problemResponse(c, notFound('Project not found'));
    return c.json(graph);
  },
);

jiraRoutes.get('/integrations/jira/metadata', requireAuth, requireRole('operational'), async (c) => {
  const auth = getAuth(c);
  const { db } = createDb(env.DATABASE_URL);
  const integration = await getJiraIntegration(db, auth.tenantId);
  if (!integration) return c.json({ metadata: null });
  return c.json({ metadata: readJiraMetadata(integration) });
});
