import type { Database } from '@beacon/db';
import type { SalesforceIntegrationMetadata } from '@beacon/shared';
import { buildIntegrationHealthEvent } from '@beacon/shared/events';
import { env } from '../../env.js';
import { runInBackground } from '../../lib/background-job.js';
import { invalidateTenantDashboardCache } from '../../lib/dashboard-cache.js';
import { assertMockIntegrationAllowed, isMockAccessToken } from '../../lib/mock-integration.js';
import {
  acquireSyncLock,
  getSyncProgress,
  releaseSyncLock,
  setSyncProgress,
} from '../../lib/sync-lock.js';
import { SalesforceClient } from './client.js';
import {
  createSyncJob,
  getLatestSyncJob,
  getSalesforceCredentials,
  getSalesforceIntegration,
  readIntegrationMetadata,
  saveSalesforceCredentials,
  setIntegrationStatus,
  updateSalesforceMetadata,
  updateSyncJob,
  upsertCustomerFromSalesforce,
  upsertProjectFromSalesforce,
} from './integration-service.js';
import { getMockOpportunities } from './mock-data.js';
import { mapOpportunityRecord, refreshAccessToken } from './oauth.js';
import { notifyAdminsIntegrationAuthFailure } from '../integrations/degraded-alerts.js';
import { notifyAdminsInitialSyncComplete } from '../integrations/sync-notifications.js';
import { runSalesforceMappingHealthCheck } from './field-mapping-rails.js';
import { publishEvent } from '../events/ingest.js';
import {
  autoApplyJiraMappings,
  autoApplySlackMappings,
} from '../integrations/setup-orchestrator.js';
import type { SalesforceCredentials } from './types.js';

export interface SyncResult {
  jobId: string;
  recordsProcessed: number;
  recordsTotal: number;
  jobType: 'bulk' | 'incremental';
}

export async function runSalesforceSync(
  db: Database,
  tenantId: string,
  jobType: 'bulk' | 'incremental' = 'bulk',
): Promise<SyncResult> {
  const lockKey = `sf-sync:${tenantId}`;
  const acquired = await acquireSyncLock(lockKey);
  if (!acquired) {
    throw new Error('A Salesforce sync is already running for this organization');
  }

  const integration = await getSalesforceIntegration(db, tenantId);
  if (!integration || integration.status === 'disconnected') {
    await releaseSyncLock(lockKey);
    throw new Error('Salesforce is not connected');
  }

  let metadata = readIntegrationMetadata(integration);
  const isFirstSync = !integration.lastSyncAt;
  if (!metadata.mappingComplete) {
    metadata = await runSalesforceMappingHealthCheck(db, tenantId);
    if (!metadata.mappingComplete) {
      await releaseSyncLock(lockKey);
      throw new Error('Salesforce field mappings could not be auto-configured');
    }
  }

  const job = await createSyncJob(db, tenantId, integration.id, jobType);
  await setIntegrationStatus(db, tenantId, 'syncing');

  try {
    const credentials = await getSalesforceCredentials(db, tenantId);
    if (!credentials) {
      throw new Error('Missing Salesforce credentials');
    }

    const records = await fetchOpportunities(db, tenantId, credentials, metadata, jobType);
    const recordsTotal = records.length;
    let processed = 0;
    let latestModstamp = metadata.lastSystemModstamp ?? null;

    await setSyncProgress(lockKey, {
      status: 'running',
      recordsProcessed: 0,
      recordsTotal,
      startedAt: new Date().toISOString(),
    });

    for (const record of records) {
      const mapped = mapOpportunityRecord(record, metadata.fieldMappings);
      const customer = await upsertCustomerFromSalesforce(
        db,
        tenantId,
        mapped.accountId,
        mapped.accountName,
      );
      await upsertProjectFromSalesforce(db, tenantId, customer.id, {
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
      if (mapped.systemModstamp) {
        latestModstamp = mapped.systemModstamp;
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

    const nextMetadata: SalesforceIntegrationMetadata = {
      ...metadata,
      lastSystemModstamp: latestModstamp,
      syncProgress: {
        status: 'completed',
        recordsProcessed: processed,
        recordsTotal,
        startedAt: job.startedAt?.toISOString(),
        completedAt: new Date().toISOString(),
        error: null,
      },
    };

    await updateSalesforceMetadata(db, tenantId, nextMetadata);
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
        source: 'salesforce',
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
        source: 'salesforce',
        sourceLabel: 'Salesforce',
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
    const message = error instanceof Error ? error.message : 'Salesforce sync failed';
    await updateSyncJob(db, tenantId, job.id, {
      status: 'failed',
      error: message,
      completedAt: new Date(),
    });
    await setIntegrationStatus(db, tenantId, 'degraded', message);
    void notifyAdminsIntegrationAuthFailure(db, tenantId, 'salesforce', message).catch(() => undefined);
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
  credentials: SalesforceCredentials,
  metadata: SalesforceIntegrationMetadata,
  jobType: 'bulk' | 'incremental',
) {
  if (isMockAccessToken(credentials.accessToken)) {
    assertMockIntegrationAllowed('Mock Salesforce sync');
    return getMockOpportunities();
  }

  const refreshHandler = async (current: SalesforceCredentials) => {
    if (!env.SALESFORCE_CLIENT_ID || !env.SALESFORCE_CLIENT_SECRET) {
      throw new Error('Salesforce OAuth is not configured');
    }
    const refreshed = await refreshAccessToken({
      refreshToken: current.refreshToken,
      clientId: env.SALESFORCE_CLIENT_ID,
      clientSecret: env.SALESFORCE_CLIENT_SECRET,
      environment: current.environment,
    });
    await saveSalesforceCredentials(db, tenantId, refreshed);
    Object.assign(credentials, refreshed);
    Object.assign(current, refreshed);
  };

  const client = new SalesforceClient(credentials, refreshHandler);
  return client.queryOpportunities({
    fieldMappings: metadata.fieldMappings,
    implementationStages: metadata.implementationStages,
    lastSystemModstamp: jobType === 'incremental' ? metadata.lastSystemModstamp : null,
  });
}

export async function getSalesforceStatus(db: Database, tenantId: string) {
  const integration = await getSalesforceIntegration(db, tenantId);
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
    (await getSyncProgress(`sf-sync:${tenantId}`)) ??
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

export function startSalesforceSync(db: Database, tenantId: string, jobType: 'bulk' | 'incremental') {
  runInBackground('salesforce-sync', () => runSalesforceSync(db, tenantId, jobType), { tenantId, jobType });
}
