import type { Database } from '@beacon/db';
import {
  classifyJiraIssueType,
  mapJiraStatusCategory,
  buildIntegrationHealthEvent,
  buildTaskUpdatedEvent,
  type JiraIntegrationMetadata,
} from '@beacon/shared';
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
import { JiraClient } from './client.js';
import {
  createJiraSyncJob,
  getJiraCredentials,
  getJiraIntegration,
  getLatestJiraSyncJob,
  listJiraProjectMappings,
  readJiraMetadata,
  replaceTaskDependencies,
  saveJiraCredentials,
  setJiraIntegrationStatus,
  updateJiraMetadata,
  updateJiraSyncJob,
  upsertJiraProjectMapping,
  upsertMilestoneFromJira,
  upsertTaskFromJira,
} from './integration-service.js';
import {
  getMockJiraIssueLinks,
  getMockJiraIssues,
  getMockJiraProjects,
} from './mock-data.js';
import { refreshJiraAccessToken } from './oauth.js';
import { notifyAdminsIntegrationAuthFailure } from '../integrations/degraded-alerts.js';
import { getUnlinkedProjects } from '../graph/entity-resolution.js';
import type { JiraCredentials, JiraIssueLinkRecord, JiraIssueRecord } from './types.js';
import { publishEvent, publishEvents } from '../events/ingest.js';

export interface JiraSyncResult {
  jobId: string;
  recordsProcessed: number;
  recordsTotal: number;
  jobType: 'bulk' | 'incremental';
}

function mapIssue(
  issue: JiraIssueRecord,
  jiraProjectId: string,
  metadata: JiraIntegrationMetadata,
) {
  const issueKind = classifyJiraIssueType(issue.fields.issuetype.name, metadata.issueTypeMapping);
  const dueDate = issue.fields.duedate ? new Date(issue.fields.duedate) : null;
  return {
    externalId: issue.id,
    externalKey: issue.key,
    title: issue.fields.summary,
    issueKind,
    status: issue.fields.status.name,
    statusCategory: mapJiraStatusCategory(issue.fields.status.statusCategory?.key),
    assigneeName: issue.fields.assignee?.displayName ?? null,
    assigneeEmail: issue.fields.assignee?.emailAddress?.toLowerCase() ?? null,
    dueDate: dueDate && !Number.isNaN(dueDate.getTime()) ? dueDate : null,
    priority: issue.fields.priority?.name ?? null,
    labels: issue.fields.labels ?? [],
    parentExternalId: issue.fields.parent?.id ?? null,
    jiraProjectId,
    isCritical: (issue.fields.priority?.name ?? '').toLowerCase().includes('high'),
  };
}

function extractBlockedLinks(links: JiraIssueLinkRecord[]) {
  const pairs: Array<{ blockedId: string; blockerId: string; linkId: string }> = [];
  for (const link of links) {
    const typeName = link.type.name?.toLowerCase() ?? '';
    if (!typeName.includes('block')) continue;
    if (link.inwardIssue && link.outwardIssue) {
      pairs.push({
        blockedId: link.inwardIssue.id,
        blockerId: link.outwardIssue.id,
        linkId: link.id,
      });
    }
  }
  return pairs;
}

export async function runJiraSync(
  db: Database,
  tenantId: string,
  jobType: 'bulk' | 'incremental' = 'bulk',
): Promise<JiraSyncResult> {
  const lockKey = `jira-sync:${tenantId}`;
  const acquired = await acquireSyncLock(lockKey);
  if (!acquired) {
    throw new Error('A Jira sync is already running for this organization');
  }

  const integration = await getJiraIntegration(db, tenantId);
  if (!integration || integration.status === 'disconnected') {
    await releaseSyncLock(lockKey);
    throw new Error('Jira is not connected');
  }

  const metadata = readJiraMetadata(integration);
  const mappings = await listJiraProjectMappings(db, tenantId, integration.id);
  if (mappings.length === 0) {
    await releaseSyncLock(lockKey);
    throw new Error('Map at least one Jira project before syncing');
  }

  const job = await createJiraSyncJob(db, tenantId, integration.id, jobType);
  await setJiraIntegrationStatus(db, tenantId, 'syncing');

  try {
    const credentials = await getJiraCredentials(db, tenantId);
    if (!credentials) throw new Error('Missing Jira credentials');

    const allProjects = await fetchJiraProjects(db, tenantId, credentials);
    const mappedExternalIds = new Set(mappings.map((mapping) => mapping.externalId));
    const orphanProjectIds = allProjects
      .filter((project) => !mappedExternalIds.has(project.id))
      .map((project) => project.id);

    let processed = 0;
    let recordsTotal = 0;
    const taskIdByExternal = new Map<string, string>();
    const milestoneIdByExternal = new Map<string, string>();
    const dependencyPairs: Array<{ blockedId: string; blockerId: string; linkId: string }> = [];
    const bulkEvents: ReturnType<typeof buildTaskUpdatedEvent>[] = [];

    await setSyncProgress(lockKey, {
      status: 'running',
      recordsProcessed: 0,
      recordsTotal: 0,
      startedAt: new Date().toISOString(),
    });

    for (const mapping of mappings) {
      const jiraProject = allProjects.find((project) => project.id === mapping.externalId);
      if (!jiraProject) continue;

      const issues = await fetchJiraIssues(db, tenantId, credentials, jiraProject.key);
      const links = await fetchJiraLinks(credentials, jiraProject.id, issues);
      dependencyPairs.push(...extractBlockedLinks(links));
      recordsTotal += issues.length;

      const epics = issues.filter(
        (issue) => classifyJiraIssueType(issue.fields.issuetype.name, metadata.issueTypeMapping) === 'epic',
      );
      const nonEpics = issues.filter(
        (issue) => classifyJiraIssueType(issue.fields.issuetype.name, metadata.issueTypeMapping) !== 'epic',
      );

      for (const issue of epics) {
        const mapped = mapIssue(issue, jiraProject.id, metadata);
        const milestone = await upsertMilestoneFromJira(db, tenantId, mapping.internalId, {
          externalId: mapped.externalId,
          name: mapped.title,
          status: mapped.statusCategory === 'done' ? 'completed' : mapped.statusCategory,
          dueDate: mapped.dueDate,
        });
        milestoneIdByExternal.set(mapped.externalId, milestone.id);
        processed += 1;
      }

      for (const issue of nonEpics) {
        const mapped = mapIssue(issue, jiraProject.id, metadata);
        if (mapped.issueKind === 'unknown') continue;

        const parentMilestoneId = mapped.parentExternalId
          ? (milestoneIdByExternal.get(mapped.parentExternalId) ?? null)
          : null;

        const task = await upsertTaskFromJira(db, tenantId, mapping.internalId, {
          externalId: mapped.externalId,
          title: mapped.title,
          status: mapped.status,
          statusCategory: mapped.statusCategory,
          assigneeName: mapped.assigneeName,
          assigneeEmail: mapped.assigneeEmail,
          dueDate: mapped.dueDate,
          priority: mapped.priority,
          labels: mapped.labels,
          milestoneId: parentMilestoneId,
          isCritical: mapped.isCritical,
        });
        taskIdByExternal.set(mapped.externalId, task.id);
        bulkEvents.push(
          buildTaskUpdatedEvent({
            tenantId,
            projectId: mapping.internalId,
            source: 'jira',
            externalId: mapped.externalId,
            sourceUpdatedAt: issue.fields.updated ?? new Date().toISOString(),
            payload: { title: mapped.title, status: mapped.status },
          }),
        );
        processed += 1;
      }

      await updateJiraSyncJob(db, tenantId, job.id, { recordsProcessed: processed, recordsTotal });
      await setSyncProgress(lockKey, {
        status: 'running',
        recordsProcessed: processed,
        recordsTotal,
      });
    }

    const dependencies = dependencyPairs
      .map((pair) => {
        const taskId = taskIdByExternal.get(pair.blockedId);
        const dependsOnTaskId = taskIdByExternal.get(pair.blockerId);
        if (!taskId || !dependsOnTaskId || taskId === dependsOnTaskId) return null;
        return { taskId, dependsOnTaskId, externalLinkId: pair.linkId };
      })
      .filter((dep): dep is { taskId: string; dependsOnTaskId: string; externalLinkId: string } =>
        Boolean(dep),
      );

    await replaceTaskDependencies(db, tenantId, dependencies);

    const nextMetadata: JiraIntegrationMetadata = {
      ...metadata,
      orphanProjectIds,
      lastSyncAt: new Date().toISOString(),
      syncProgress: {
        status: 'completed',
        recordsProcessed: processed,
        recordsTotal,
        startedAt: job.startedAt?.toISOString(),
        completedAt: new Date().toISOString(),
        error: null,
      },
    };

    await updateJiraMetadata(db, tenantId, nextMetadata);
    await updateJiraSyncJob(db, tenantId, job.id, {
      status: 'completed',
      recordsProcessed: processed,
      recordsTotal,
      completedAt: new Date(),
    });
    await setJiraIntegrationStatus(db, tenantId, 'connected');
    await setSyncProgress(lockKey, {
      status: 'completed',
      recordsProcessed: processed,
      recordsTotal,
      completedAt: new Date().toISOString(),
    });

    bulkEvents.push(
      buildIntegrationHealthEvent({
        tenantId,
        source: 'jira',
        status: 'connected',
        recordsProcessed: processed,
        jobType,
      }),
    );
    await publishEvents(bulkEvents, 'bulk');
    await invalidateTenantDashboardCache(tenantId);

    return { jobId: job.id, recordsProcessed: processed, recordsTotal, jobType };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Jira sync failed';
    await updateJiraSyncJob(db, tenantId, job.id, {
      status: 'failed',
      error: message,
      completedAt: new Date(),
    });
    await setJiraIntegrationStatus(db, tenantId, 'degraded', message);
    void notifyAdminsIntegrationAuthFailure(db, tenantId, 'jira', message).catch(() => undefined);
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

async function fetchJiraProjects(db: Database, tenantId: string, credentials: JiraCredentials) {
  if (isMockAccessToken(credentials.accessToken)) {
    assertMockIntegrationAllowed('Mock Jira sync');
    return getMockJiraProjects();
  }
  const client = await buildLiveClient(db, tenantId, credentials);
  return client.listProjects();
}

async function fetchJiraIssues(
  db: Database,
  tenantId: string,
  credentials: JiraCredentials,
  projectKey: string,
) {
  if (isMockAccessToken(credentials.accessToken)) {
    assertMockIntegrationAllowed('Mock Jira sync');
    const project = getMockJiraProjects().find((item) => item.key === projectKey);
    return project ? getMockJiraIssues(project.id) : [];
  }
  const client = await buildLiveClient(db, tenantId, credentials);
  return client.searchIssues(`project = ${projectKey} ORDER BY updated DESC`);
}

async function fetchJiraLinks(
  credentials: JiraCredentials,
  projectId: string,
  issues: JiraIssueRecord[],
) {
  if (isMockAccessToken(credentials.accessToken)) {
    assertMockIntegrationAllowed('Mock Jira sync');
    return getMockJiraIssueLinks(projectId);
  }
  const client = new JiraClient(credentials);
  return client.getIssueLinks(issues.map((issue) => issue.key));
}

async function buildLiveClient(db: Database, tenantId: string, credentials: JiraCredentials) {
  const refreshHandler = async (current: JiraCredentials) => {
    if (!env.JIRA_CLIENT_ID || !env.JIRA_CLIENT_SECRET) {
      throw new Error('Jira OAuth is not configured');
    }
    const refreshed = await refreshJiraAccessToken({
      refreshToken: current.refreshToken,
      clientId: env.JIRA_CLIENT_ID,
      clientSecret: env.JIRA_CLIENT_SECRET,
      cloudId: current.cloudId,
      siteUrl: current.siteUrl,
    });
    if (tenantId) {
      await saveJiraCredentials(db, tenantId, refreshed);
    }
    Object.assign(current, refreshed);
  };

  return new JiraClient(credentials, refreshHandler);
}

export async function listAvailableJiraProjects(db: Database, tenantId: string) {
  const credentials = await getJiraCredentials(db, tenantId);
  if (!credentials) return [];
  if (isMockAccessToken(credentials.accessToken)) {
    assertMockIntegrationAllowed('Mock Jira project listing');
    return getMockJiraProjects();
  }
  const client = await buildLiveClient(db, tenantId, credentials);
  return client.listProjects();
}

export async function getJiraStatus(db: Database, tenantId: string) {
  const integration = await getJiraIntegration(db, tenantId);
  if (!integration) {
    return {
      connected: false,
      status: 'disconnected' as const,
      metadata: null,
      latestJob: null,
      syncProgress: null,
      mappings: [],
      orphans: [],
    };
  }

  const metadata = readJiraMetadata(integration);
  const latestJob = await getLatestJiraSyncJob(db, tenantId, integration.id);
  const syncProgress =
    (await getSyncProgress(`jira-sync:${tenantId}`)) ??
    (metadata.syncProgress ? { ...metadata.syncProgress } : null);
  const mappings = await listJiraProjectMappings(db, tenantId, integration.id);
  const allProjects = integration.status === 'disconnected' ? [] : await listAvailableJiraProjects(db, tenantId);
  const mappedIds = new Set(mappings.map((mapping) => mapping.externalId));
  const orphans = allProjects.filter((project) => !mappedIds.has(project.id));
  const unlinkedBeaconProjects =
    integration.status !== 'disconnected' ? await getUnlinkedProjects(db, tenantId) : [];

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
    mappings,
    orphans,
    unlinkedBeaconProjectCount: unlinkedBeaconProjects.length,
  };
}

export function startJiraSync(db: Database, tenantId: string, jobType: 'bulk' | 'incremental') {
  runInBackground('jira-sync', () => runJiraSync(db, tenantId, jobType), { tenantId, jobType });
}

export async function ensureDefaultMockMapping(db: Database, tenantId: string, integrationId: string) {
  const mappings = await listJiraProjectMappings(db, tenantId, integrationId);
  if (mappings.length > 0) return mappings[0]!;

  const { findProjectByName } = await import('./integration-service.js');
  const project = await findProjectByName(db, tenantId, 'Acme Corp Implementation');
  if (!project) return null;

  return upsertJiraProjectMapping(db, tenantId, integrationId, {
    internalId: project.id,
    externalId: '10001',
    metadata: { jiraProjectKey: 'ACME', jiraProjectName: 'Acme Corp Implementation' },
  });
}
