import type { Database } from '@beacon/db';
import { buildIntegrationHealthEvent, buildSlackMessageEvent } from '@beacon/shared/events';
import type { SlackIntegrationMetadata } from '@beacon/shared';
import { buildDomainCollisionWarning } from '@beacon/shared';
import {
  acquireSyncLock,
  getSyncProgress,
  releaseSyncLock,
  setSyncProgress,
} from '../../lib/sync-lock.js';
import { scheduleRiskEvaluation } from '../risk/engine.js';
import { notifyAdminsIntegrationAuthFailure } from '../integrations/degraded-alerts.js';
import { runInBackground } from '../../lib/background-job.js';
import { invalidateTenantDashboardCache } from '../../lib/dashboard-cache.js';
import { publishEvent, publishEvents } from '../events/ingest.js';
import {
  createSlackSyncJob,
  getLatestSlackSyncJob,
  getSlackCredentials,
  getSlackIntegration,
  listSlackChannelMappings,
  listSlackChannelSignals,
  readSlackMetadata,
  setSlackIntegrationStatus,
  updateSlackMetadata,
  updateSlackSyncJob,
  upsertSlackChannelMapping,
  upsertSlackChannelSignal,
  findProjectByName,
  findFirstActiveProject,
} from './integration-service.js';
import {
  DEFAULT_MOCK_CHANNEL_MAPPINGS,
  getMockSlackChannels,
  toMessageSamples,
} from './mock-data.js';
import {
  computeSignalsForChannel,
  createSlackClient,
  deriveChannelAccess,
  isoFromSlackTs,
  messageSampleToEventPayload,
  signalsToDates,
} from './signals.js';

export interface SlackSyncResult {
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
  let project = await findProjectByName(db, tenantId, 'Acme Corp Implementation');
  if (!project) {
    project = await findFirstActiveProject(db, tenantId);
  }
  if (!project) return;

  for (const mapping of DEFAULT_MOCK_CHANNEL_MAPPINGS) {
    await upsertSlackChannelMapping(db, tenantId, integrationId, {
      internalId: project.id,
      externalId: mapping.channelId,
      metadata: {
        channelName: mapping.channelName,
        botPresent: true,
      },
    });
  }
}

export async function getSlackStatus(db: Database, tenantId: string) {
  const integration = await getSlackIntegration(db, tenantId);
  if (!integration || integration.status === 'disconnected') {
    return { connected: false, status: 'disconnected' as const };
  }

  const metadata = readSlackMetadata(integration);
  const mappings = await listSlackChannelMappings(db, tenantId, integration.id);
  const signals = await listSlackChannelSignals(db, tenantId, integration.id);
  const latestJob = await getLatestSlackSyncJob(db, tenantId, integration.id);
  const progress = metadata.syncProgress ?? getSyncProgress(`slack-sync:${tenantId}`);

  const channelsMissingBot = signals
    .filter((signal) => !signal.botPresent)
    .map((signal) => signal.channelId);

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
    metadata: {
      ...metadata,
      channelsMissingBot,
    },
    mappings,
    signals: signals.map((signal) => ({
      channelId: signal.channelId,
      channelName: signal.channelName,
      projectId: signal.projectId,
      botPresent: signal.botPresent,
      botAccessError: signal.botAccessError,
      lastCustomerMessageAt: signal.lastCustomerMessageAt,
      lastInternalResponseAt: signal.lastInternalResponseAt,
      lastActivityAt: signal.lastActivityAt,
      lastEscalationAt: signal.lastEscalationAt,
      stale: signal.stale,
    })),
    latestJob,
    syncProgress: progress,
  };
}

export async function listAvailableSlackChannels(db: Database, tenantId: string) {
  const credentials = await getSlackCredentials(db, tenantId);
  if (!credentials) throw new Error('Slack is not connected');

  const client = createSlackClient(credentials);
  const channels = await client.listChannels();
  return channels.map((channel) => ({
    id: channel.id,
    name: channel.name,
    isPrivate: channel.isPrivate,
    ...deriveChannelAccess(channel),
  }));
}

export async function runSlackSync(
  db: Database,
  tenantId: string,
  jobType: 'bulk' | 'incremental' = 'bulk',
): Promise<SlackSyncResult> {
  const lockKey = `slack-sync:${tenantId}`;
  const acquired = await acquireSyncLock(lockKey);
  if (!acquired) {
    throw new Error('A Slack sync is already running for this organization');
  }

  const integration = await getSlackIntegration(db, tenantId);
  if (!integration || integration.status === 'disconnected') {
    await releaseSyncLock(lockKey);
    throw new Error('Slack is not connected');
  }

  const mappings = await listSlackChannelMappings(db, tenantId, integration.id);
  if (mappings.length === 0) {
    await releaseSyncLock(lockKey);
    throw new Error('Map at least one Slack channel before syncing');
  }

  const job = await createSlackSyncJob(db, tenantId, integration.id, jobType);
  await setSlackIntegrationStatus(db, tenantId, 'syncing');

  let metadata = readSlackMetadata(integration);
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
  await updateSlackMetadata(db, tenantId, metadata);
  await setSyncProgress(lockKey, metadata.syncProgress!);

  try {
    const credentials = await getSlackCredentials(db, tenantId);
    if (!credentials) throw new Error('Missing Slack credentials');

    const client = createSlackClient(credentials);
    const channels = await client.listChannels();
    const channelMap = new Map(channels.map((channel) => [channel.id, channel]));
    const events = [];
    let processed = 0;
    const missingBot: string[] = [];

    for (const mapping of mappings) {
      const channel =
        channelMap.get(mapping.externalId) ??
        getMockSlackChannels().find((item) => item.id === mapping.externalId);
      if (!channel) {
        missingBot.push(mapping.externalId);
        processed += 1;
        continue;
      }

      const domainOverrides = Array.isArray(mapping.metadata?.domainOverrides)
        ? (mapping.metadata.domainOverrides as string[])
        : [];
      const signals = await computeSignalsForChannel({
        client,
        channel,
        metadata,
        domainOverrides,
      });

      if (!signals.botPresent) {
        missingBot.push(signals.channelId);
      }

      const dates = signalsToDates(signals);
      await upsertSlackChannelSignal(db, tenantId, {
        integrationId: integration.id,
        mappingId: mapping.id,
        projectId: mapping.internalId,
        channelId: signals.channelId,
        channelName: signals.channelName,
        botPresent: signals.botPresent,
        botAccessError: signals.botAccessError,
        ...dates,
        messageSampleCount: signals.messageSampleCount,
        metadata: {
          domainOverrides,
        },
        stale: false,
      });

      const samples = signals.botPresent
        ? await import('./signals.js').then((mod) => mod.buildChannelMessageSamples(client, channel.id, 20))
        : toMessageSamples(channel.id).slice(0, 5);

      for (const sample of samples.slice(0, 5)) {
        events.push(
          buildSlackMessageEvent({
            tenantId,
            projectId: mapping.internalId,
            channelId: channel.id,
            messageTs: sample.ts,
            sourceUpdatedAt: isoFromSlackTs(sample.ts),
            payload: messageSampleToEventPayload(channel.id, sample),
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
      await updateSlackMetadata(db, tenantId, metadata);
      await setSyncProgress(lockKey, metadata.syncProgress!);
      await updateSlackSyncJob(db, tenantId, job.id, {
        recordsProcessed: processed,
        recordsTotal: mappings.length,
      });
    }

    if (events.length > 0) {
      await publishEvents(events, 'bulk');
    }

    metadata = {
      ...metadata,
      channelsMissingBot: missingBot,
      lastSyncAt: new Date().toISOString(),
      syncProgress: {
        status: missingBot.length > 0 && processed === missingBot.length ? 'failed' : 'completed',
        recordsProcessed: processed,
        recordsTotal: mappings.length,
        completedAt: new Date().toISOString(),
        error: missingBot.length > 0 ? `${missingBot.length} channel(s) missing bot access` : null,
      },
    };
    await updateSlackMetadata(db, tenantId, metadata);
    const completedProgress = metadata.syncProgress!;
    await updateSlackSyncJob(db, tenantId, job.id, {
      status: completedProgress.status === 'failed' ? 'failed' : 'completed',
      recordsProcessed: processed,
      recordsTotal: mappings.length,
      error: completedProgress.error,
      completedAt: new Date(),
    });

    const finalStatus =
      missingBot.length > 0 ? 'degraded' : 'connected';
    await setSlackIntegrationStatus(
      db,
      tenantId,
      finalStatus,
      completedProgress.error,
    );

    await publishEvent(
      buildIntegrationHealthEvent({
        tenantId,
        source: 'slack',
        status: finalStatus,
        recordsProcessed: processed,
        jobType,
      }),
      'bulk',
    );

    scheduleRiskEvaluation(db, tenantId);
    await invalidateTenantDashboardCache(tenantId);

    return {
      jobId: job.id,
      recordsProcessed: processed,
      recordsTotal: mappings.length,
      jobType,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Slack sync failed';
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
    await updateSlackMetadata(db, tenantId, metadata);
    await updateSlackSyncJob(db, tenantId, job.id, {
      status: 'failed',
      error: message,
      completedAt: new Date(),
    });
    await setSlackIntegrationStatus(db, tenantId, 'degraded', message);
    void notifyAdminsIntegrationAuthFailure(db, tenantId, 'slack', message).catch(() => undefined);
    throw error;
  } finally {
    await releaseSyncLock(lockKey);
  }
}

export function startSlackSync(
  db: Database,
  tenantId: string,
  jobType: 'bulk' | 'incremental' = 'bulk',
): void {
  runInBackground('slack-sync', () => runSlackSync(db, tenantId, jobType), { tenantId, jobType });
}
