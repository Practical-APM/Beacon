import type { Database } from '@beacon/db';
import { computeCalendarProjectSignals } from '@beacon/shared/google-calendar';
import { buildDomainCollisionWarning } from '@beacon/shared';
import { buildCalendarMeetingEvent, buildIntegrationHealthEvent } from '@beacon/shared/events';
import {
  acquireSyncLock,
  getSyncProgress,
  releaseSyncLock,
  setSyncProgress,
} from '../../lib/sync-lock.js';
import { env } from '../../env.js';
import { runInBackground } from '../../lib/background-job.js';
import { invalidateTenantDashboardCache } from '../../lib/dashboard-cache.js';
import { publishEvents } from '../events/ingest.js';
import { scheduleRiskEvaluation } from '../risk/engine.js';
import { notifyAdminsIntegrationAuthFailure } from '../integrations/degraded-alerts.js';
import { createGoogleCalendarClient } from './client.js';
import {
  createGoogleCalendarSyncJob,
  getGoogleCalendarCredentials,
  getGoogleCalendarIntegration,
  getLatestGoogleCalendarSyncJob,
  listGoogleCalendarMappings,
  listGoogleCalendarSignals,
  readGoogleCalendarMetadata,
  setGoogleCalendarIntegrationStatus,
  updateGoogleCalendarMetadata,
  updateGoogleCalendarSyncJob,
  upsertGoogleCalendarMapping,
  upsertGoogleCalendarSignal,
} from './integration-service.js';
import {
  DEFAULT_MOCK_CALENDAR_MAPPINGS,
  getMockCalendars,
  getMockCalendarMeetings,
  toMeetingSamples,
} from './mock-data.js';

export interface GoogleCalendarSyncResult {
  jobId: string;
  recordsProcessed: number;
  recordsTotal: number;
  jobType: 'bulk' | 'incremental';
}

export async function ensureDefaultMockMappings(
  db: Database,
  tenantId: string,
  integrationId: string,
) {
  const project = await import('./integration-service.js').then((mod) =>
    mod.findProjectByName(db, tenantId, 'Acme Corp Implementation'),
  );
  if (!project) return;

  for (const mapping of DEFAULT_MOCK_CALENDAR_MAPPINGS) {
    await upsertGoogleCalendarMapping(db, tenantId, integrationId, {
      internalId: project.id,
      externalId: mapping.calendarId,
      metadata: { calendarName: mapping.calendarName },
    });
  }
}

export async function getGoogleCalendarStatus(db: Database, tenantId: string) {
  const integration = await getGoogleCalendarIntegration(db, tenantId);
  if (!integration || integration.status === 'disconnected') {
    return { connected: false, status: 'disconnected' as const };
  }

  const metadata = readGoogleCalendarMetadata(integration);
  const mappings = await listGoogleCalendarMappings(db, tenantId, integration.id);
  const signals = await listGoogleCalendarSignals(db, tenantId, integration.id);
  const latestJob = await getLatestGoogleCalendarSyncJob(db, tenantId, integration.id);
  const progress = metadata.syncProgress ?? getSyncProgress(`google-calendar-sync:${tenantId}`);

  const mappingOverrides = mappings.map((mapping) =>
    Array.isArray(mapping.metadata?.domainOverrides)
      ? (mapping.metadata.domainOverrides as string[])
      : [],
  );
  const domainCollisionWarning = buildDomainCollisionWarning(
    metadata.internalDomains,
    metadata.customerDomains,
    mappingOverrides,
  );

  return {
    connected: true,
    status: integration.status,
    lastSyncAt: integration.lastSyncAt,
    lastError: integration.lastError,
    externalOrgId: integration.externalOrgId,
    domainCollisionWarning,
    metadata,
    mappings,
    signals: signals.map((signal) => ({
      calendarId: signal.calendarId,
      calendarName: signal.calendarName,
      projectId: signal.projectId,
      lastMeetingAt: signal.lastMeetingAt,
      lastCustomerMeetingAt: signal.lastCustomerMeetingAt,
      meetingCount30d: signal.meetingCount30d,
      stale: signal.stale,
    })),
    latestJob,
    syncProgress: progress,
  };
}

export async function listAvailableGoogleCalendars(db: Database, tenantId: string) {
  const credentials = await getGoogleCalendarCredentials(db, tenantId);
  if (!credentials) throw new Error('Google Calendar is not connected');
  const client = createGoogleCalendarClient(credentials);
  return client.listCalendars();
}

export async function runGoogleCalendarSync(
  db: Database,
  tenantId: string,
  jobType: 'bulk' | 'incremental' = 'bulk',
): Promise<GoogleCalendarSyncResult> {
  const lockKey = `google-calendar-sync:${tenantId}`;
  const acquired = await acquireSyncLock(lockKey);
  if (!acquired) {
    throw new Error('A Google Calendar sync is already running for this organization');
  }

  const integration = await getGoogleCalendarIntegration(db, tenantId);
  if (!integration || integration.status === 'disconnected') {
    await releaseSyncLock(lockKey);
    throw new Error('Google Calendar is not connected');
  }

  const mappings = await listGoogleCalendarMappings(db, tenantId, integration.id);
  if (mappings.length === 0) {
    await releaseSyncLock(lockKey);
    throw new Error('Map at least one calendar before syncing');
  }

  const job = await createGoogleCalendarSyncJob(db, tenantId, integration.id, jobType);
  await setGoogleCalendarIntegrationStatus(db, tenantId, 'syncing');

  let metadata = readGoogleCalendarMetadata(integration);
  metadata = {
    ...metadata,
    syncProgress: {
      status: 'running',
      recordsProcessed: 0,
      recordsTotal: mappings.length,
      startedAt: new Date().toISOString(),
      error: null,
    },
  };
  await updateGoogleCalendarMetadata(db, tenantId, metadata);
  await setSyncProgress(lockKey, metadata.syncProgress!);

  try {
    const credentials = await getGoogleCalendarCredentials(db, tenantId);
    if (!credentials) throw new Error('Missing Google Calendar credentials');

    const client = createGoogleCalendarClient(credentials);
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const events = [];
    let processed = 0;

    for (const mapping of mappings) {
      const calendarName =
        typeof mapping.metadata?.calendarName === 'string'
          ? mapping.metadata.calendarName
          : getMockCalendars().find((item) => item.id === mapping.externalId)?.name ?? mapping.externalId;

      const meetings =
        credentials.accessToken.includes('mock') || !env.GOOGLE_CALENDAR_ENABLED
          ? getMockCalendarMeetings(mapping.externalId)
          : await client.listMeetings(mapping.externalId, since);

      const domainOverrides = Array.isArray(mapping.metadata?.domainOverrides)
        ? (mapping.metadata.domainOverrides as string[])
        : [];

      const signals = computeCalendarProjectSignals({
        meetings: toMeetingSamples(meetings),
        internalDomains: metadata.internalDomains,
        customerDomains: metadata.customerDomains,
        domainOverrides,
      });

      await upsertGoogleCalendarSignal(db, tenantId, {
        integrationId: integration.id,
        mappingId: mapping.id,
        projectId: mapping.internalId,
        calendarId: mapping.externalId,
        calendarName,
        lastMeetingAt: signals.lastMeetingAt ? new Date(signals.lastMeetingAt) : null,
        lastCustomerMeetingAt: signals.lastCustomerMeetingAt
          ? new Date(signals.lastCustomerMeetingAt)
          : null,
        meetingCount30d: signals.meetingCount30d,
        metadata: { domainOverrides },
        stale: false,
      });

      for (const meeting of meetings.slice(0, 5)) {
        events.push(
          buildCalendarMeetingEvent({
            tenantId,
            projectId: mapping.internalId,
            calendarId: mapping.externalId,
            meetingId: meeting.id,
            sourceUpdatedAt: meeting.startAt,
            payload: {
              summary: meeting.summary,
              attendeeCount: meeting.attendeeEmails.length,
            },
          }),
        );
      }

      processed += 1;
      metadata = {
        ...metadata,
        syncProgress: {
          ...metadata.syncProgress!,
          recordsProcessed: processed,
          recordsTotal: mappings.length,
        },
      };
      await updateGoogleCalendarMetadata(db, tenantId, metadata);
      await setSyncProgress(lockKey, metadata.syncProgress!);
      await updateGoogleCalendarSyncJob(db, tenantId, job.id, {
        recordsProcessed: processed,
        recordsTotal: mappings.length,
      });
    }

    events.push(
      buildIntegrationHealthEvent({
        tenantId,
        source: 'google_calendar',
        status: 'completed',
        recordsProcessed: processed,
        jobType,
      }),
    );
    if (events.length > 0) await publishEvents(events, 'bulk');

    metadata = {
      ...metadata,
      lastSyncAt: new Date().toISOString(),
      syncProgress: {
        status: 'completed',
        recordsProcessed: processed,
        recordsTotal: mappings.length,
        completedAt: new Date().toISOString(),
        error: null,
      },
    };
    await updateGoogleCalendarMetadata(db, tenantId, metadata);
    await updateGoogleCalendarSyncJob(db, tenantId, job.id, {
      status: 'completed',
      recordsProcessed: processed,
      recordsTotal: mappings.length,
      completedAt: new Date(),
    });
    await setGoogleCalendarIntegrationStatus(db, tenantId, 'connected');
    await scheduleRiskEvaluation(db, tenantId);
    await invalidateTenantDashboardCache(tenantId);

    return { jobId: job.id, recordsProcessed: processed, recordsTotal: mappings.length, jobType };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Sync failed';
    metadata = {
      ...metadata,
      syncProgress: {
        status: 'failed',
        recordsProcessed: metadata.syncProgress?.recordsProcessed ?? 0,
        recordsTotal: mappings.length,
        completedAt: new Date().toISOString(),
        error: message,
      },
    };
    await updateGoogleCalendarMetadata(db, tenantId, metadata);
    await updateGoogleCalendarSyncJob(db, tenantId, job.id, {
      status: 'failed',
      error: message,
      completedAt: new Date(),
    });
    await setGoogleCalendarIntegrationStatus(db, tenantId, 'degraded', message);
    void notifyAdminsIntegrationAuthFailure(db, tenantId, 'google_calendar', message).catch(
      () => undefined,
    );
    throw error;
  } finally {
    await releaseSyncLock(lockKey);
  }
}

export function startGoogleCalendarSync(
  db: Database,
  tenantId: string,
  jobType: 'bulk' | 'incremental' = 'bulk',
) {
  runInBackground(
    'google-calendar-sync',
    () => runGoogleCalendarSync(db, tenantId, jobType),
    { tenantId, jobType },
  );
}
