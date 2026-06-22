import {
  integrationMappings,
  integrationSyncJobs,
  integrations,
  milestones,
  projects,
  taskDependencies,
  tasks,
  withTenantContext,
  type Database,
} from '@beacon/db';
import type { JiraIntegrationMetadata } from '@beacon/shared';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { decryptSecret, encryptSecret, getEncryptionKey } from '../../lib/crypto.js';
import { notFound } from '../../lib/errors.js';
import { buildDefaultJiraMetadata, toMetadataJson } from './oauth.js';
import type { JiraCredentials } from './types.js';

function parseMetadata(raw: Record<string, unknown> | null | undefined): JiraIntegrationMetadata {
  const fallback = buildDefaultJiraMetadata('', '');
  if (!raw || typeof raw !== 'object') return fallback;
  return {
    ...fallback,
    ...(raw as Partial<JiraIntegrationMetadata>),
    issueTypeMapping: {
      ...fallback.issueTypeMapping,
      ...((raw.issueTypeMapping as JiraIntegrationMetadata['issueTypeMapping']) ?? {}),
    },
    orphanProjectIds: (raw.orphanProjectIds as string[] | undefined) ?? [],
  };
}

export async function getJiraIntegration(db: Database, tenantId: string) {
  return withTenantContext(db, tenantId, async () => {
    const [row] = await db
      .select()
      .from(integrations)
      .where(and(eq(integrations.tenantId, tenantId), eq(integrations.source, 'jira')))
      .limit(1);
    return row ?? null;
  });
}

export async function upsertJiraIntegration(
  db: Database,
  tenantId: string,
  params: {
    credentials: JiraCredentials;
    metadata: JiraIntegrationMetadata;
    status?: 'connected' | 'degraded' | 'disconnected' | 'syncing';
  },
) {
  return withTenantContext(db, tenantId, async () => {
    const encrypted = encryptSecret(JSON.stringify(params.credentials), getEncryptionKey());
    const existing = await getJiraIntegration(db, tenantId);

    if (existing) {
      const [row] = await db
        .update(integrations)
        .set({
          status: params.status ?? 'connected',
          externalOrgId: params.credentials.cloudId,
          credentialsEncrypted: encrypted,
          metadata: toMetadataJson(params.metadata),
          lastError: null,
          updatedAt: new Date(),
        })
        .where(eq(integrations.id, existing.id))
        .returning();
      return row!;
    }

    const [row] = await db
      .insert(integrations)
      .values({
        tenantId,
        source: 'jira',
        status: params.status ?? 'connected',
        externalOrgId: params.credentials.cloudId,
        credentialsEncrypted: encrypted,
        metadata: toMetadataJson(params.metadata),
      })
      .returning();
    return row!;
  });
}

export async function getJiraCredentials(
  db: Database,
  tenantId: string,
): Promise<JiraCredentials | null> {
  const integration = await getJiraIntegration(db, tenantId);
  if (!integration?.credentialsEncrypted) return null;
  const decrypted = decryptSecret(integration.credentialsEncrypted, getEncryptionKey());
  return JSON.parse(decrypted) as JiraCredentials;
}

export async function saveJiraCredentials(
  db: Database,
  tenantId: string,
  credentials: JiraCredentials,
): Promise<void> {
  const integration = await getJiraIntegration(db, tenantId);
  if (!integration) throw notFound('Jira integration not found');
  const encrypted = encryptSecret(JSON.stringify(credentials), getEncryptionKey());
  await withTenantContext(db, tenantId, async () => {
    await db
      .update(integrations)
      .set({ credentialsEncrypted: encrypted, updatedAt: new Date() })
      .where(eq(integrations.id, integration.id));
  });
}

export async function updateJiraMetadata(
  db: Database,
  tenantId: string,
  metadata: JiraIntegrationMetadata,
): Promise<JiraIntegrationMetadata> {
  const integration = await getJiraIntegration(db, tenantId);
  if (!integration) throw notFound('Jira integration not found');
  await withTenantContext(db, tenantId, async () => {
    await db
      .update(integrations)
      .set({ metadata: toMetadataJson(metadata), updatedAt: new Date() })
      .where(eq(integrations.id, integration.id));
  });
  return metadata;
}

export async function setJiraIntegrationStatus(
  db: Database,
  tenantId: string,
  status: 'connected' | 'degraded' | 'disconnected' | 'syncing',
  lastError?: string | null,
) {
  const integration = await getJiraIntegration(db, tenantId);
  if (!integration) throw notFound('Jira integration not found');
  await withTenantContext(db, tenantId, async () => {
    await db
      .update(integrations)
      .set({
        status,
        lastError: lastError ?? null,
        updatedAt: new Date(),
        ...(status === 'connected' ? { lastSyncAt: new Date() } : {}),
      })
      .where(eq(integrations.id, integration.id));
  });
}

export async function disconnectJira(db: Database, tenantId: string) {
  const integration = await getJiraIntegration(db, tenantId);
  if (!integration) throw notFound('Jira integration not found');
  await withTenantContext(db, tenantId, async () => {
    await db
      .update(integrations)
      .set({
        status: 'disconnected',
        credentialsEncrypted: null,
        externalOrgId: null,
        lastError: null,
        metadata: toMetadataJson(buildDefaultJiraMetadata('', '')),
        updatedAt: new Date(),
      })
      .where(eq(integrations.id, integration.id));
  });
}

export function readJiraMetadata(integration: {
  metadata: Record<string, unknown> | null;
}): JiraIntegrationMetadata {
  return parseMetadata(integration.metadata);
}

export async function createJiraSyncJob(
  db: Database,
  tenantId: string,
  integrationId: string,
  jobType: 'bulk' | 'incremental',
) {
  return withTenantContext(db, tenantId, async () => {
    const [job] = await db
      .insert(integrationSyncJobs)
      .values({
        tenantId,
        integrationId,
        jobType,
        status: 'running',
        startedAt: new Date(),
      })
      .returning();
    return job!;
  });
}

export async function updateJiraSyncJob(
  db: Database,
  tenantId: string,
  jobId: string,
  patch: {
    status?: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
    recordsProcessed?: number;
    recordsTotal?: number | null;
    error?: string | null;
    completedAt?: Date | null;
  },
) {
  await withTenantContext(db, tenantId, async () => {
    await db
      .update(integrationSyncJobs)
      .set(patch)
      .where(and(eq(integrationSyncJobs.id, jobId), eq(integrationSyncJobs.tenantId, tenantId)));
  });
}

export async function listJiraProjectMappings(db: Database, tenantId: string, integrationId: string) {
  return withTenantContext(db, tenantId, async () => {
    return db
      .select()
      .from(integrationMappings)
      .where(
        and(
          eq(integrationMappings.tenantId, tenantId),
          eq(integrationMappings.integrationId, integrationId),
          eq(integrationMappings.mappingType, 'project_to_jira'),
          isNull(integrationMappings.deletedAt),
        ),
      );
  });
}

export async function upsertJiraProjectMapping(
  db: Database,
  tenantId: string,
  integrationId: string,
  input: { internalId: string; externalId: string; metadata?: Record<string, unknown> },
) {
  return withTenantContext(db, tenantId, async () => {
    const existing = await db
      .select()
      .from(integrationMappings)
      .where(
        and(
          eq(integrationMappings.tenantId, tenantId),
          eq(integrationMappings.integrationId, integrationId),
          eq(integrationMappings.mappingType, 'project_to_jira'),
          eq(integrationMappings.internalId, input.internalId),
          isNull(integrationMappings.deletedAt),
        ),
      )
      .limit(1);

    if (existing[0]) {
      const [row] = await db
        .update(integrationMappings)
        .set({
          externalId: input.externalId,
          metadata: input.metadata ?? {},
          updatedAt: new Date(),
        })
        .where(eq(integrationMappings.id, existing[0].id))
        .returning();
      return row!;
    }

    const [row] = await db
      .insert(integrationMappings)
      .values({
        tenantId,
        integrationId,
        mappingType: 'project_to_jira',
        internalId: input.internalId,
        externalId: input.externalId,
        metadata: input.metadata ?? {},
      })
      .returning();
    return row!;
  });
}

export async function upsertMilestoneFromJira(
  db: Database,
  tenantId: string,
  projectId: string,
  input: {
    externalId: string;
    name: string;
    status: string;
    dueDate: Date | null;
  },
) {
  return withTenantContext(db, tenantId, async () => {
    const [existing] = await db
      .select()
      .from(milestones)
      .where(
        and(
          eq(milestones.tenantId, tenantId),
          eq(milestones.externalSource, 'jira'),
          eq(milestones.externalId, input.externalId),
        ),
      )
      .limit(1);

    const values = {
      name: input.name,
      status: input.status,
      dueDate: input.dueDate,
      updatedAt: new Date(),
    };

    if (existing) {
      const [updated] = await db
        .update(milestones)
        .set(values)
        .where(eq(milestones.id, existing.id))
        .returning();
      return updated!;
    }

    const [created] = await db
      .insert(milestones)
      .values({
        tenantId,
        projectId,
        externalId: input.externalId,
        externalSource: 'jira',
        ...values,
      })
      .returning();
    return created!;
  });
}

export async function upsertTaskFromJira(
  db: Database,
  tenantId: string,
  projectId: string,
  input: {
    externalId: string;
    title: string;
    status: string;
    statusCategory: 'todo' | 'in_progress' | 'done';
    assigneeName: string | null;
    assigneeEmail: string | null;
    dueDate: Date | null;
    priority: string | null;
    labels: string[];
    milestoneId: string | null;
    isCritical: boolean;
  },
) {
  return withTenantContext(db, tenantId, async () => {
    const [existing] = await db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.tenantId, tenantId),
          eq(tasks.externalSource, 'jira'),
          eq(tasks.externalId, input.externalId),
        ),
      )
      .limit(1);

    const values = {
      title: input.title,
      status: input.status,
      statusCategory: input.statusCategory,
      assigneeName: input.assigneeName,
      assigneeEmail: input.assigneeEmail,
      dueDate: input.dueDate,
      priority: input.priority,
      labels: input.labels,
      milestoneId: input.milestoneId,
      isCritical: input.isCritical,
      deletedAt: null,
      updatedAt: new Date(),
    };

    if (existing) {
      const [updated] = await db
        .update(tasks)
        .set({ ...values, projectId })
        .where(eq(tasks.id, existing.id))
        .returning();
      return updated!;
    }

    const [created] = await db
      .insert(tasks)
      .values({
        tenantId,
        projectId,
        externalId: input.externalId,
        externalSource: 'jira',
        ...values,
      })
      .returning();
    return created!;
  });
}

export async function replaceTaskDependencies(
  db: Database,
  tenantId: string,
  dependencies: Array<{ taskId: string; dependsOnTaskId: string; externalLinkId?: string | null }>,
) {
  await withTenantContext(db, tenantId, async () => {
    for (const dep of dependencies) {
      await db
        .insert(taskDependencies)
        .values({
          tenantId,
          taskId: dep.taskId,
          dependsOnTaskId: dep.dependsOnTaskId,
          externalLinkId: dep.externalLinkId ?? null,
        })
        .onConflictDoNothing();
    }
  });
}

export async function getProjectTaskDependencies(db: Database, tenantId: string, projectId: string) {
  return withTenantContext(db, tenantId, async () => {
    const projectTasks = await db
      .select({ id: tasks.id, title: tasks.title, externalId: tasks.externalId })
      .from(tasks)
      .where(
        and(eq(tasks.tenantId, tenantId), eq(tasks.projectId, projectId), isNull(tasks.deletedAt)),
      );

    const taskIds = projectTasks.map((task) => task.id);
    if (taskIds.length === 0) return { tasks: [], dependencies: [] };

    const dependencies = await db
      .select()
      .from(taskDependencies)
      .where(eq(taskDependencies.tenantId, tenantId));

    const scoped = dependencies.filter(
      (dep) => taskIds.includes(dep.taskId) && taskIds.includes(dep.dependsOnTaskId),
    );

    return { tasks: projectTasks, dependencies: scoped };
  });
}

export async function getLatestJiraSyncJob(db: Database, tenantId: string, integrationId: string) {
  return withTenantContext(db, tenantId, async () => {
    const rows = await db
      .select()
      .from(integrationSyncJobs)
      .where(
        and(
          eq(integrationSyncJobs.tenantId, tenantId),
          eq(integrationSyncJobs.integrationId, integrationId),
        ),
      )
      .orderBy(desc(integrationSyncJobs.createdAt))
      .limit(1);
    return rows[0] ?? null;
  });
}

export async function findProjectByName(db: Database, tenantId: string, name: string) {
  return withTenantContext(db, tenantId, async () => {
    const [row] = await db
      .select()
      .from(projects)
      .where(and(eq(projects.tenantId, tenantId), eq(projects.name, name), isNull(projects.deletedAt)))
      .limit(1);
    return row ?? null;
  });
}
