import { createDb, projects, withTenantContext } from '@beacon/db';
import { suggestCalendarMappings } from '@beacon/shared/google-calendar';
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
import {
  disconnectGoogleCalendar,
  getGoogleCalendarIntegration,
  upsertGoogleCalendarMapping,
  upsertGoogleCalendarIntegration,
} from '../../services/google-calendar/integration-service.js';
import { createMockGoogleCalendarCredentials } from '../../services/google-calendar/mock-data.js';
import {
  buildDefaultGoogleCalendarMetadata,
  buildGoogleCalendarOAuthUrl,
  exchangeGoogleCalendarAuthorizationCode,
} from '../../services/google-calendar/oauth.js';
import {
  ensureDefaultMockMappings,
  getGoogleCalendarStatus,
  listAvailableGoogleCalendars,
  runGoogleCalendarSync,
  startGoogleCalendarSync,
} from '../../services/google-calendar/sync.js';

const mappingSchema = z.object({
  beaconProjectId: z.string().uuid(),
  calendarId: z.string().min(1),
  calendarName: z.string().optional(),
  domainOverrides: z.array(z.string()).optional(),
});

export const googleCalendarRoutes = new Hono();

googleCalendarRoutes.get(
  '/integrations/google-calendar/connect-url',
  requireAuth,
  requireRole('admin'),
  async (c) => {
    if (!env.GOOGLE_CALENDAR_ENABLED) {
      return c.json(
        buildOAuthConnectResponse({
          enabled: false,
          devMessage: 'Google Calendar OAuth is not configured. Use mock connect in development.',
          prodMessage: 'Google Calendar OAuth is not configured. Contact your administrator.',
        }),
      );
    }

    const auth = getAuth(c);
    const state = randomBytes(24).toString('hex');
    await storeOAuthState(state, { tenantId: auth.tenantId, userId: auth.userId }, 'google_calendar');

    return c.json({
      connectUrl: buildGoogleCalendarOAuthUrl({
        clientId: env.GOOGLE_CALENDAR_CLIENT_ID!,
        redirectUri: env.GOOGLE_CALENDAR_REDIRECT_URI,
        state,
      }),
      mockMode: false,
    });
  },
);

googleCalendarRoutes.get('/integrations/google-calendar/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const error = c.req.query('error');

  if (error) {
    return c.redirect(`${env.WEB_APP_URL}/integrations?google_calendar_error=${encodeURIComponent(error)}`);
  }
  if (!code || !state) {
    return c.redirect(`${env.WEB_APP_URL}/integrations?google_calendar_error=missing_oauth_params`);
  }

  const { consumeOAuthState } = await import('../../lib/sync-lock.js');
  const oauthState = await consumeOAuthState(state, 'google_calendar');
  if (!oauthState?.tenantId) {
    return c.redirect(`${env.WEB_APP_URL}/integrations?google_calendar_error=invalid_oauth_state`);
  }
  if (!env.GOOGLE_CALENDAR_ENABLED) {
    return c.redirect(`${env.WEB_APP_URL}/integrations?google_calendar_error=google_calendar_not_configured`);
  }

  try {
    const credentials = await exchangeGoogleCalendarAuthorizationCode({
      code,
      clientId: env.GOOGLE_CALENDAR_CLIENT_ID!,
      clientSecret: env.GOOGLE_CALENDAR_CLIENT_SECRET!,
      redirectUri: env.GOOGLE_CALENDAR_REDIRECT_URI,
    });
    const metadata = buildDefaultGoogleCalendarMetadata(
      credentials.accountEmail,
      credentials.accountName,
    );
    const { db } = createDb(env.DATABASE_URL);
    await upsertGoogleCalendarIntegration(db, oauthState.tenantId, {
      credentials,
      metadata,
      status: 'connected',
    });
    await recordAuditEvent(db, {
      tenantId: oauthState.tenantId,
      userId: oauthState.userId ?? null,
      action: 'integration_connected',
      resourceType: 'integration',
      resourceId: 'google_calendar',
      metadata: { source: 'google_calendar' },
      ...auditContextFromRequest(c),
    });
    return c.redirect(`${env.WEB_APP_URL}/integrations?google_calendar_connected=1`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'oauth_failed';
    return c.redirect(`${env.WEB_APP_URL}/integrations?google_calendar_error=${encodeURIComponent(message)}`);
  }
});

googleCalendarRoutes.post(
  '/integrations/google-calendar/mock-connect',
  requireAuth,
  requireRole('admin'),
  async (c) => {
    if (!env.AUTH_DEV_MODE) {
      return problemResponse(c, badRequest('Mock connect is only available in development mode'));
    }

    const auth = getAuth(c);
    const credentials = createMockGoogleCalendarCredentials();
    const metadata = buildDefaultGoogleCalendarMetadata(
      credentials.accountEmail,
      credentials.accountName,
    );
    const { db } = createDb(env.DATABASE_URL);
    const integration = await upsertGoogleCalendarIntegration(db, auth.tenantId, {
      credentials,
      metadata,
      status: 'connected',
    });
    await ensureDefaultMockMappings(db, auth.tenantId, integration.id);
    await recordAuditEvent(db, {
      tenantId: auth.tenantId,
      userId: auth.userId,
      action: 'integration_connected',
      resourceType: 'integration',
      resourceId: integration.id,
      metadata: { source: 'google_calendar', mock: true },
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
  },
);

googleCalendarRoutes.get(
  '/integrations/google-calendar/status',
  requireAuth,
  requireRole('operational'),
  async (c) => {
    const auth = getAuth(c);
    const { db } = createDb(env.DATABASE_URL);
    const status = await getGoogleCalendarStatus(db, auth.tenantId);
    return c.json(status);
  },
);

googleCalendarRoutes.get(
  '/integrations/google-calendar/calendars',
  requireAuth,
  requireRole('operational'),
  async (c) => {
    const auth = getAuth(c);
    const { db } = createDb(env.DATABASE_URL);
    const integration = await getGoogleCalendarIntegration(db, auth.tenantId);
    if (!integration || integration.status === 'disconnected') {
      return problemResponse(c, badRequest('Connect Google Calendar before listing calendars'));
    }

    const calendars = await listAvailableGoogleCalendars(db, auth.tenantId);
    const beaconProjects = await withTenantContext(db, auth.tenantId, async () =>
      db
        .select({ id: projects.id, name: projects.name })
        .from(projects)
        .where(and(eq(projects.tenantId, auth.tenantId), isNull(projects.deletedAt))),
    );

    return c.json({
      calendars,
      suggestions: suggestCalendarMappings(calendars, beaconProjects),
    });
  },
);

googleCalendarRoutes.post(
  '/integrations/google-calendar/calendar-mappings',
  requireAuth,
  requireRole('admin'),
  async (c) => {
    const auth = getAuth(c);
    const body = mappingSchema.safeParse(await c.req.json());
    if (!body.success) return problemResponse(c, badRequest(body.error.message));

    const { db } = createDb(env.DATABASE_URL);
    const integration = await getGoogleCalendarIntegration(db, auth.tenantId);
    if (!integration) {
      return problemResponse(c, badRequest('Connect Google Calendar before creating mappings'));
    }

    const mapping = await upsertGoogleCalendarMapping(db, auth.tenantId, integration.id, {
      internalId: body.data.beaconProjectId,
      externalId: body.data.calendarId,
      metadata: {
        calendarName: body.data.calendarName,
        domainOverrides: body.data.domainOverrides ?? [],
      },
    });
    await recordAuditEvent(db, {
      tenantId: auth.tenantId,
      userId: auth.userId,
      action: 'integration_mapping_updated',
      resourceType: 'integration_mapping',
      resourceId: mapping.id,
      metadata: {
        source: 'google_calendar',
        beaconProjectId: body.data.beaconProjectId,
        calendarId: body.data.calendarId,
      },
      ...auditContextFromRequest(c),
    });

    return c.json({ mapping });
  },
);

googleCalendarRoutes.post(
  '/integrations/google-calendar/sync',
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

    const integration = await getGoogleCalendarIntegration(db, auth.tenantId);
    if (!integration || integration.status === 'disconnected') {
      return problemResponse(c, badRequest('Connect Google Calendar before syncing'));
    }

    if (body.async) {
      startGoogleCalendarSync(db, auth.tenantId, jobType);
      return c.json({ status: 'started', jobType }, 202);
    }

    try {
      const result = await runGoogleCalendarSync(db, auth.tenantId, jobType);
      return c.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sync failed';
      return problemResponse(c, badRequest(message));
    }
  },
);

googleCalendarRoutes.delete(
  '/integrations/google-calendar/disconnect',
  requireAuth,
  requireRole('admin'),
  async (c) => {
    const auth = getAuth(c);
    const { db } = createDb(env.DATABASE_URL);
    await disconnectGoogleCalendar(db, auth.tenantId);
    await recordAuditEvent(db, {
      tenantId: auth.tenantId,
      userId: auth.userId,
      action: 'integration_disconnected',
      resourceType: 'integration',
      resourceId: 'google_calendar',
      metadata: { source: 'google_calendar' },
      ...auditContextFromRequest(c),
    });
    return c.body(null, 204);
  },
);
