import type { Database } from '@beacon/db';
import type { DynamicsIntegrationMetadata } from '@beacon/shared';
import { validateDynamicsFieldMappings } from '@beacon/shared';
import { buildIntegrationHealthEvent } from '@beacon/shared/events';
import { invalidateTenantDashboardCache } from '../../lib/dashboard-cache.js';
import { env } from '../../env.js';
import { assertMockIntegrationAllowed, isMockAccessToken } from '../../lib/mock-integration.js';
import {
  acquireSyncLock,
  getSyncProgress,
  releaseSyncLock,
  setSyncProgress,
} from '../../lib/sync-lock.js';
import { notifyAdminsIntegrationAuthFailure } from '../integrations/degraded-alerts.js';
import { notifyAdminsInitialSyncComplete } from '../integrations/sync-notifications.js';
import {
  autoApplyJiraMappings,
  autoApplySlackMappings,
} from '../integrations/setup-orchestrator.js';
import { publishEvent } from '../events/ingest.js';
import { fetchLiveOpportunities } from './client.js';
import { runDynamicsMappingHealthCheck } from './field-mapping-rails.js';
import {
  createSyncJob,
  getDynamicsCredentials,
  getDynamicsIntegration,
  getLatestSyncJob,
  readIntegrationMetadata,
  saveDynamicsCredentials,
  setIntegrationStatus,
  updateDynamicsMetadata,
  updateSyncJob,
  upsertCustomerFromDynamics,
  upsertProjectFromDynamics,
} from './integration-service.js';
import { getMockOpportunities } from './mock-data.js';
import { mapOpportunityRecord, refreshAccessToken } from './oauth.js';
import type { DynamicsCredentials } from './types.js';

export interface SyncResult {
  jobId: string;
  recordsProcessed: number;
  recordsTotal: number;
  jobType: 'bulk' | 'incremental';
}

export async function runDynamicsSync(
  db: Database,
  tenantId: string,
  jobType: 'bulk' | 'incremental' = 'bulk',
): Promise<SyncResult> {
  const lockKey = `dyn-sync:${tenantId}`;
  const acquired = await acquireSyncLock(lockKey);
  if (!acquired) {
    throw new Error('A Dynamics 365 sync is already running for this organization');
  }

  const integration = await getDynamicsIntegration(db, tenantId);
  if (!integration || integration.status === 'disconnected') {
    await releaseSyncLock(lockKey);
    throw new Error('Dynamics 365 is not connected');
  }

  const isFirstSync = !integration.lastSyncAt;
  let metadata = readIntegrationMetadata(integration);
  if (!metadata.mappingComplete) {
    metadata = await runDynamicsMappingHealthCheck(db, tenantId);
    if (!metadata.mappingComplete) {
      await releaseSyncLock(lockKey);
      throw new Error('Dynamics field mappings could not be auto-configured');
    }
  }

  const job = await createSyncJob(db, tenantId, integration.id, jobType);
  await setIntegrationStatus(db, tenantId, 'syncing');

  try {
    const credentials = await getDynamicsCredentials(db, tenantId);
    if (!credentials) {
      throw new Error('Missing Dynamics 365 credentials');
    }

    const records = await fetchOpportunities(db, tenantId, credentials, metadata, jobType);
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
      const mapped = mapOpportunityRecord(record, metadata.fieldMappings);
      const customer = await upsertCustomerFromDynamics(
        db,
        tenantId,
        mapped.accountId,
        mapped.accountName,
      );
      await upsertProjectFromDynamics(db, tenantId, customer.id, {
        opportunityId: mapped.opportunityId,
        opportunityName: mapped.opportunityName,
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

    const nextMetadata: DynamicsIntegrationMetadata = {
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

    await updateDynamicsMetadata(db, tenantId, nextMetadata);
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
        source: 'microsoft_dynamics',
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
        source: 'microsoft_dynamics',
        sourceLabel: 'Dynamics 365',
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
    const message = error instanceof Error ? error.message : 'Dynamics 365 sync failed';
    await updateSyncJob(db, tenantId, job.id, {
      status: 'failed',
      error: message,
      completedAt: new Date(),
    });
    await setIntegrationStatus(db, tenantId, 'degraded', message);
    void notifyAdminsIntegrationAuthFailure(db, tenantId, 'microsoft_dynamics', message).catch(
      () => undefined,
    );
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

async function fetchOpportunities(
  db: Database,
  tenantId: string,
  credentials: DynamicsCredentials,
  metadata: DynamicsIntegrationMetadata,
  jobType: 'bulk' | 'incremental',
) {
  if (isMockAccessToken(credentials.accessToken)) {
    assertMockIntegrationAllowed('Mock Dynamics sync');
    const records = getMockOpportunities();
    if (jobType === 'incremental' && metadata.lastModifiedAt) {
      return records.filter((record) => record.modifiedon > metadata.lastModifiedAt!);
    }
    return records;
  }

  const refreshHandler = async (current: DynamicsCredentials) => {
    if (!env.DYNAMICS_CLIENT_ID || !env.DYNAMICS_CLIENT_SECRET || !current.refreshToken) {
      throw new Error('Dynamics OAuth is not configured');
    }
    const refreshed = await refreshAccessToken({
      refreshToken: current.refreshToken,
      clientId: env.DYNAMICS_CLIENT_ID,
      clientSecret: env.DYNAMICS_CLIENT_SECRET,
      azureTenantId: current.azureTenantId,
      orgUrl: current.orgUrl,
      orgId: current.orgId,
    });
    await saveDynamicsCredentials(db, tenantId, refreshed);
    Object.assign(credentials, refreshed);
    Object.assign(current, refreshed);
  };

  return fetchLiveOpportunities(credentials, metadata, jobType, refreshHandler);
}

export async function getDynamicsStatus(db: Database, tenantId: string) {
  const integration = await getDynamicsIntegration(db, tenantId);
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
    (await getSyncProgress(`dyn-sync:${tenantId}`)) ??
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

export function startDynamicsSync(db: Database, tenantId: string, jobType: 'bulk' | 'incremental') {
  void runDynamicsSync(db, tenantId, jobType).catch(() => undefined);
}

export function validateDynamicsMappingsForSync(metadata: DynamicsIntegrationMetadata) {
  return validateDynamicsFieldMappings(metadata.fieldMappings);
}
