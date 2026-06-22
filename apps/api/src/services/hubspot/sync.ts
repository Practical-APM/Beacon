import type { Database } from '@beacon/db';
import type { HubSpotIntegrationMetadata } from '@beacon/shared';
import { validateHubSpotFieldMappings } from '@beacon/shared';
import { buildIntegrationHealthEvent } from '@beacon/shared/events';
import {
  acquireSyncLock,
  getSyncProgress,
  releaseSyncLock,
  setSyncProgress,
} from '../../lib/sync-lock.js';
import { runHubSpotMappingHealthCheck } from './field-mapping-rails.js';
import { notifyAdminsIntegrationAuthFailure } from '../integrations/degraded-alerts.js';
import { notifyAdminsInitialSyncComplete } from '../integrations/sync-notifications.js';
import { runInBackground } from '../../lib/background-job.js';
import { invalidateTenantDashboardCache } from '../../lib/dashboard-cache.js';
import { assertMockIntegrationAllowed, isMockAccessToken } from '../../lib/mock-integration.js';
import {
  createSyncJob,
  getHubSpotCredentials,
  getHubSpotIntegration,
  getLatestSyncJob,
  readIntegrationMetadata,
  saveHubSpotCredentials,
  setIntegrationStatus,
  updateHubSpotMetadata,
  updateSyncJob,
  upsertCustomerFromHubSpot,
  upsertProjectFromHubSpot,
} from './integration-service.js';
import { getMockDeals } from './mock-data.js';
import { fetchLiveDeals } from './client.js';
import { mapDealRecord, refreshAccessToken } from './oauth.js';
import { env } from '../../env.js';
import { publishEvent } from '../events/ingest.js';
import {
  autoApplyJiraMappings,
  autoApplySlackMappings,
} from '../integrations/setup-orchestrator.js';

export interface SyncResult {
  jobId: string;
  recordsProcessed: number;
  recordsTotal: number;
  jobType: 'bulk' | 'incremental';
}

export async function runHubSpotSync(
  db: Database,
  tenantId: string,
  jobType: 'bulk' | 'incremental' = 'bulk',
): Promise<SyncResult> {
  const lockKey = `hs-sync:${tenantId}`;
  const acquired = await acquireSyncLock(lockKey);
  if (!acquired) {
    throw new Error('A HubSpot sync is already running for this organization');
  }

  const integration = await getHubSpotIntegration(db, tenantId);
  if (!integration || integration.status === 'disconnected') {
    await releaseSyncLock(lockKey);
    throw new Error('HubSpot is not connected');
  }

  const isFirstSync = !integration.lastSyncAt;
  let metadata = readIntegrationMetadata(integration);
  if (!metadata.mappingComplete) {
    metadata = await runHubSpotMappingHealthCheck(db, tenantId);
    if (!metadata.mappingComplete) {
      await releaseSyncLock(lockKey);
      throw new Error('HubSpot field mappings could not be auto-configured');
    }
  }

  const job = await createSyncJob(db, tenantId, integration.id, jobType);
  await setIntegrationStatus(db, tenantId, 'syncing');

  try {
    const credentials = await getHubSpotCredentials(db, tenantId);
    if (!credentials) {
      throw new Error('Missing HubSpot credentials');
    }

    const records = await fetchDeals(db, tenantId, credentials, metadata, jobType);
    const recordsTotal = records.length;
    let processed = 0;
    let latestModified = metadata.lastModifiedAt ?? null;

    await setSyncProgress(lockKey, {
      status: 'running',
      recordsProcessed: 0,
      recordsTotal,
      startedAt: new Date().toISOString(),
    });

    for (const record of records) {
      const mapped = mapDealRecord(record, metadata.fieldMappings);
      const customer = await upsertCustomerFromHubSpot(
        db,
        tenantId,
        mapped.companyId,
        mapped.companyName,
      );
      await upsertProjectFromHubSpot(db, tenantId, customer.id, {
        dealId: mapped.dealId,
        dealName: mapped.dealName,
        ownerName: mapped.ownerName,
        ownerEmail: mapped.ownerEmail,
        arrAmount: mapped.arrAmount,
        arrCurrency: mapped.arrCurrency,
        goLiveDate: mapped.goLiveDate,
        dataComplete: mapped.dataComplete,
      });

      processed += 1;
      if (mapped.lastModified) {
        latestModified = mapped.lastModified;
      }

      if (processed % 3 === 0 || processed === recordsTotal) {
        await updateSyncJob(db, tenantId, job.id, { recordsProcessed: processed, recordsTotal });
        await setSyncProgress(lockKey, {
          status: 'running',
          recordsProcessed: processed,
          recordsTotal,
          startedAt: job.startedAt?.toISOString(),
        });
      }
    }

    const nextMetadata: HubSpotIntegrationMetadata = {
      ...metadata,
      lastModifiedAt: latestModified,
      syncProgress: {
        status: 'completed',
        recordsProcessed: processed,
        recordsTotal,
        startedAt: job.startedAt?.toISOString(),
        completedAt: new Date().toISOString(),
        error: null,
      },
    };

    await updateHubSpotMetadata(db, tenantId, nextMetadata);
    await updateSyncJob(db, tenantId, job.id, {
      status: 'completed',
      recordsProcessed: processed,
      recordsTotal,
      completedAt: new Date(),
    });
    await setIntegrationStatus(db, tenantId, 'connected');
    await setSyncProgress(lockKey, {
      status: 'completed',
      recordsProcessed: processed,
      recordsTotal,
      completedAt: new Date().toISOString(),
    });

    await publishEvent(
      buildIntegrationHealthEvent({
        tenantId,
        source: 'hubspot',
        status: 'connected',
        recordsProcessed: processed,
        jobType,
      }),
      'bulk',
    );

    await autoApplyJiraMappings(db, tenantId);
    await autoApplySlackMappings(db, tenantId);
    await invalidateTenantDashboardCache(tenantId);

    if (isFirstSync && jobType === 'bulk') {
      void notifyAdminsInitialSyncComplete(db, tenantId, {
        source: 'hubspot',
        sourceLabel: 'HubSpot',
        recordsProcessed: processed,
      }).catch(() => undefined);
    }

    return {
      jobId: job.id,
      recordsProcessed: processed,
      recordsTotal,
      jobType,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'HubSpot sync failed';
    await updateSyncJob(db, tenantId, job.id, {
      status: 'failed',
      error: message,
      completedAt: new Date(),
    });
    await setIntegrationStatus(db, tenantId, 'degraded', message);
    void notifyAdminsIntegrationAuthFailure(db, tenantId, 'hubspot', message).catch(() => undefined);
    await setSyncProgress(lockKey, {
      status: 'failed',
      error: message,
      completedAt: new Date().toISOString(),
    });
    throw error;
  } finally {
    await releaseSyncLock(lockKey);
  }
}

async function fetchDeals(
  db: Database,
  tenantId: string,
  credentials: { accessToken: string; refreshToken?: string },
  metadata: HubSpotIntegrationMetadata,
  jobType: 'bulk' | 'incremental',
) {
  if (isMockAccessToken(credentials.accessToken)) {
    assertMockIntegrationAllowed('Mock HubSpot sync');
    const deals = getMockDeals();
    if (jobType === 'incremental' && metadata.lastModifiedAt) {
      return deals.filter((deal) => deal.hs_lastmodifieddate > metadata.lastModifiedAt!);
    }
    return deals;
  }

  const refreshHandler = async (current: { accessToken: string; refreshToken?: string }) => {
    if (!env.HUBSPOT_CLIENT_ID || !env.HUBSPOT_CLIENT_SECRET || !current.refreshToken) {
      throw new Error('HubSpot OAuth is not configured');
    }
    const refreshed = await refreshAccessToken({
      refreshToken: current.refreshToken,
      clientId: env.HUBSPOT_CLIENT_ID,
      clientSecret: env.HUBSPOT_CLIENT_SECRET,
    });
    await saveHubSpotCredentials(db, tenantId, refreshed);
    Object.assign(credentials, refreshed);
    Object.assign(current, refreshed);
  };

  return fetchLiveDeals(
    credentials as Awaited<ReturnType<typeof getHubSpotCredentials>> & { accessToken: string },
    metadata,
    jobType,
    refreshHandler,
  );
}

export async function getHubSpotStatus(db: Database, tenantId: string) {
  const integration = await getHubSpotIntegration(db, tenantId);
  if (!integration) {
    return {
      connected: false,
      status: 'disconnected' as const,
      metadata: null,
      latestJob: null,
      syncProgress: null,
    };
  }

  const metadata = readIntegrationMetadata(integration);
  const latestJob = await getLatestSyncJob(db, tenantId, integration.id);
  const syncProgress =
    (await getSyncProgress(`hs-sync:${tenantId}`)) ??
    (metadata.syncProgress ? { ...metadata.syncProgress } : null);

  return {
    connected: integration.status !== 'disconnected',
    status: integration.status,
    lastSyncAt: integration.lastSyncAt,
    lastError: integration.lastError,
    externalOrgId: integration.externalOrgId,
    metadata,
    latestJob: latestJob
      ? {
          id: latestJob.id,
          jobType: latestJob.jobType,
          status: latestJob.status,
          recordsProcessed: latestJob.recordsProcessed,
          recordsTotal: latestJob.recordsTotal,
          error: latestJob.error,
          startedAt: latestJob.startedAt,
          completedAt: latestJob.completedAt,
        }
      : null,
    syncProgress,
  };
}

export function startHubSpotSync(db: Database, tenantId: string, jobType: 'bulk' | 'incremental') {
  runInBackground('hubspot-sync', () => runHubSpotSync(db, tenantId, jobType), { tenantId, jobType });
}

export function validateHubSpotMappingsForSync(metadata: HubSpotIntegrationMetadata) {
  return validateHubSpotFieldMappings(metadata.fieldMappings);
}
