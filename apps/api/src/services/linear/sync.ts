import type { Database } from '@beacon/db';
import { mapLinearWorkflowState, type LinearIntegrationMetadata } from '@beacon/shared';
import { buildIntegrationHealthEvent } from '@beacon/shared/events';
import { runInBackground } from '../../lib/background-job.js';
import { invalidateTenantDashboardCache } from '../../lib/dashboard-cache.js';
import { assertMockIntegrationAllowed, isMockAccessToken } from '../../lib/mock-integration.js';
import {
  acquireSyncLock,
  getSyncProgress,
  releaseSyncLock,
  setSyncProgress,
} from '../../lib/sync-lock.js';
import { notifyAdminsIntegrationAuthFailure } from '../integrations/degraded-alerts.js';
import { publishEvent } from '../events/ingest.js';
import {
  createLinearSyncJob,
  getLatestLinearSyncJob,
  getLinearCredentials,
  getLinearIntegration,
  listLinearTeamMappings,
  readLinearMetadata,
  setLinearIntegrationStatus,
  updateLinearMetadata,
  updateLinearSyncJob,
  upsertTaskFromLinear,
} from './integration-service.js';
import { getMockLinearIssues, getMockLinearTeams } from './mock-data.js';
import type { LinearCredentials, LinearIssueRecord } from './types.js';

export interface LinearSyncResult {
  jobId: string;
  recordsProcessed: number;
  recordsTotal: number;
  jobType: 'bulk' | 'incremental';
}

export async function listAvailableLinearTeams(_db: Database, _tenantId: string) {
  return getMockLinearTeams();
}

export async function ensureDefaultMockLinearMapping(
  db: Database,
  tenantId: string,
  integrationId: string,
) {
  const { upsertLinearTeamMapping } = await import('./integration-service.js');
  const teams = getMockLinearTeams();
  const firstTeam = teams[0];
  if (!firstTeam) return;

  const { projects, withTenantContext } = await import('@beacon/db');
  const { and, eq, isNull } = await import('drizzle-orm');
  const beaconProjects = await withTenantContext(db, tenantId, async () =>
    db
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(and(eq(projects.tenantId, tenantId), isNull(projects.deletedAt)))
      .limit(1),
  );

  const project = beaconProjects[0];
  if (!project) return;

  await upsertLinearTeamMapping(db, tenantId, integrationId, {
    internalId: project.id,
    externalId: firstTeam.id,
    metadata: { linearTeamKey: firstTeam.key, linearTeamName: firstTeam.name, autoMapped: true },
  });
}

export async function runLinearSync(
  db: Database,
  tenantId: string,
  jobType: 'bulk' | 'incremental' = 'bulk',
): Promise<LinearSyncResult> {
  const lockKey = `linear-sync:${tenantId}`;
  const acquired = await acquireSyncLock(lockKey);
  if (!acquired) {
    throw new Error('A Linear sync is already running for this organization');
  }

  const integration = await getLinearIntegration(db, tenantId);
  if (!integration || integration.status === 'disconnected') {
    await releaseSyncLock(lockKey);
    throw new Error('Linear is not connected');
  }

  const mappings = await listLinearTeamMappings(db, tenantId, integration.id);
  if (mappings.length === 0) {
    await releaseSyncLock(lockKey);
    throw new Error('Map at least one Linear team before syncing');
  }

  const job = await createLinearSyncJob(db, tenantId, integration.id, jobType);
  await setLinearIntegrationStatus(db, tenantId, 'syncing');

  try {
    const credentials = await getLinearCredentials(db, tenantId);
    if (!credentials) throw new Error('Missing Linear credentials');

    const issues = await fetchLinearIssues(credentials);
    const teamToProject = new Map(mappings.map((row) => [row.externalId, row.internalId]));
    const relevantIssues = issues.filter((issue) => teamToProject.has(issue.teamId));
    const recordsTotal = relevantIssues.length;
    let processed = 0;

    await setSyncProgress(lockKey, {
      status: 'running',
      recordsProcessed: 0,
      recordsTotal,
      startedAt: new Date().toISOString(),
    });

    for (const issue of relevantIssues) {
      const projectId = teamToProject.get(issue.teamId);
      if (!projectId) continue;

      await upsertTaskFromLinear(db, tenantId, projectId, {
        externalId: issue.id,
        title: issue.title,
        status: issue.state,
        statusCategory: mapLinearWorkflowState(issue.state),
        assigneeName: issue.assigneeName,
        assigneeEmail: issue.assigneeEmail,
        priority: issue.priority,
        isCritical: (issue.priority ?? '').toLowerCase().includes('high'),
      });

      processed += 1;
      if (processed % 5 === 0 || processed === recordsTotal) {
        await updateLinearSyncJob(db, tenantId, job.id, { recordsProcessed: processed, recordsTotal });
        await setSyncProgress(lockKey, {
          status: 'running',
          recordsProcessed: processed,
          recordsTotal,
          startedAt: job.startedAt?.toISOString(),
        });
      }
    }

    const metadata = readLinearMetadata(integration);
    const nextMetadata: LinearIntegrationMetadata = {
      ...metadata,
      syncProgress: {
        status: 'completed',
        recordsProcessed: processed,
        recordsTotal,
        startedAt: job.startedAt?.toISOString(),
        completedAt: new Date().toISOString(),
        error: null,
      },
    };
    await updateLinearMetadata(db, tenantId, nextMetadata);
    await updateLinearSyncJob(db, tenantId, job.id, {
      status: 'completed',
      recordsProcessed: processed,
      recordsTotal,
      completedAt: new Date(),
    });
    await setLinearIntegrationStatus(db, tenantId, 'connected');
    await setSyncProgress(lockKey, {
      status: 'completed',
      recordsProcessed: processed,
      recordsTotal,
      completedAt: new Date().toISOString(),
    });

    await publishEvent(
      buildIntegrationHealthEvent({
        tenantId,
        source: 'linear',
        status: 'connected',
        recordsProcessed: processed,
        jobType,
      }),
      'bulk',
    );
    await invalidateTenantDashboardCache(tenantId);

    return { jobId: job.id, recordsProcessed: processed, recordsTotal, jobType };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Linear sync failed';
    await updateLinearSyncJob(db, tenantId, job.id, {
      status: 'failed',
      error: message,
      completedAt: new Date(),
    });
    await setLinearIntegrationStatus(db, tenantId, 'degraded', message);
    void notifyAdminsIntegrationAuthFailure(db, tenantId, 'linear', message).catch(() => undefined);
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

async function fetchLinearIssues(credentials: LinearCredentials): Promise<LinearIssueRecord[]> {
  if (isMockAccessToken(credentials.accessToken)) {
    assertMockIntegrationAllowed('Mock Linear sync');
    return getMockLinearIssues();
  }

  // Live GraphQL sync can be extended here; mock path covers dev/demo flows.
  return getMockLinearIssues();
}

export async function getLinearStatus(db: Database, tenantId: string) {
  const integration = await getLinearIntegration(db, tenantId);
  if (!integration) {
    return {
      connected: false,
      status: 'disconnected' as const,
      metadata: null,
      latestJob: null,
      syncProgress: null,
      mappings: [],
    };
  }

  const metadata = readLinearMetadata(integration);
  const latestJob = await getLatestLinearSyncJob(db, tenantId, integration.id);
  const mappings = await listLinearTeamMappings(db, tenantId, integration.id);
  const syncProgress =
    (await getSyncProgress(`linear-sync:${tenantId}`)) ??
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
    mappings: mappings.map((row) => ({
      internalId: row.internalId,
      externalId: row.externalId,
      metadata: row.metadata as Record<string, unknown>,
    })),
  };
}

export function startLinearSync(db: Database, tenantId: string, jobType: 'bulk' | 'incremental') {
  runInBackground('linear-sync', () => runLinearSync(db, tenantId, jobType), { tenantId, jobType });
}
