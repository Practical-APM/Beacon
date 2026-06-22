import {
  integrationMappings,
  integrationSyncJobs,
  integrations,
  tasks,
  withTenantContext,
  type Database,
} from '@beacon/db';
import type { LinearIntegrationMetadata } from '@beacon/shared';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { decryptSecret, encryptSecret, getEncryptionKey } from '../../lib/crypto.js';
import { notFound } from '../../lib/errors.js';
import { buildDefaultLinearMetadata, toMetadataJson } from './oauth.js';
import type { LinearCredentials } from './types.js';

function parseMetadata(raw: Record<string, unknown> | null | undefined): LinearIntegrationMetadata {
  const fallback = buildDefaultLinearMetadata('', '');
  if (!raw || typeof raw !== 'object') return fallback;
  return {
    ...fallback,
    ...(raw as Partial<LinearIntegrationMetadata>),
  };
}

export async function getLinearIntegration(db: Database, tenantId: string) {
  return withTenantContext(db, tenantId, async () => {
    const [row] = await db
      .select()
      .from(integrations)
      .where(and(eq(integrations.tenantId, tenantId), eq(integrations.source, 'linear')))
      .limit(1);
    return row ?? null;
  });
}

export async function upsertLinearIntegration(
  db: Database,
  tenantId: string,
  params: {
    credentials: LinearCredentials;
    metadata: LinearIntegrationMetadata;
    status?: 'connected' | 'degraded' | 'disconnected' | 'syncing';
  },
) {
  return withTenantContext(db, tenantId, async () => {
    const encrypted = encryptSecret(JSON.stringify(params.credentials), getEncryptionKey());
    const existing = await getLinearIntegration(db, tenantId);

    if (existing) {
      const [row] = await db
        .update(integrations)
        .set({
          status: params.status ?? 'connected',
          externalOrgId: params.credentials.organizationId,
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
        source: 'linear',
        status: params.status ?? 'connected',
        externalOrgId: params.credentials.organizationId,
        credentialsEncrypted: encrypted,
        metadata: toMetadataJson(params.metadata),
      })
      .returning();
    return row!;
  });
}

export async function getLinearCredentials(
  db: Database,
  tenantId: string,
): Promise<LinearCredentials | null> {
  const integration = await getLinearIntegration(db, tenantId);
  if (!integration?.credentialsEncrypted) return null;
  const decrypted = decryptSecret(integration.credentialsEncrypted, getEncryptionKey());
  return JSON.parse(decrypted) as LinearCredentials;
}

export async function saveLinearCredentials(
  db: Database,
  tenantId: string,
  credentials: LinearCredentials,
): Promise<void> {
  const integration = await getLinearIntegration(db, tenantId);
  if (!integration) throw notFound('Linear integration not found');
  const encrypted = encryptSecret(JSON.stringify(credentials), getEncryptionKey());
  await withTenantContext(db, tenantId, async () => {
    await db
      .update(integrations)
      .set({ credentialsEncrypted: encrypted, updatedAt: new Date() })
      .where(eq(integrations.id, integration.id));
  });
}

export async function setLinearIntegrationStatus(
  db: Database,
  tenantId: string,
  status: 'connected' | 'degraded' | 'disconnected' | 'syncing',
  lastError?: string | null,
) {
  const integration = await getLinearIntegration(db, tenantId);
  if (!integration) throw notFound('Linear integration not found');
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

export async function disconnectLinear(db: Database, tenantId: string) {
  const integration = await getLinearIntegration(db, tenantId);
  if (!integration) throw notFound('Linear integration not found');
  await withTenantContext(db, tenantId, async () => {
    await db
      .update(integrations)
      .set({
        status: 'disconnected',
        credentialsEncrypted: null,
        externalOrgId: null,
        lastError: null,
        metadata: toMetadataJson(buildDefaultLinearMetadata('', '')),
        updatedAt: new Date(),
      })
      .where(eq(integrations.id, integration.id));
  });
}

export function readLinearMetadata(integration: {
  metadata: Record<string, unknown> | null;
}): LinearIntegrationMetadata {
  return parseMetadata(integration.metadata);
}

export async function createLinearSyncJob(
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

export async function updateLinearSyncJob(
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

export async function getLatestLinearSyncJob(db: Database, tenantId: string, integrationId: string) {
  return withTenantContext(db, tenantId, async () => {
    const [job] = await db
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
    return job ?? null;
  });
}

export async function listLinearTeamMappings(db: Database, tenantId: string, integrationId: string) {
  return withTenantContext(db, tenantId, async () => {
    return db
      .select()
      .from(integrationMappings)
      .where(
        and(
          eq(integrationMappings.tenantId, tenantId),
          eq(integrationMappings.integrationId, integrationId),
          eq(integrationMappings.mappingType, 'project_to_linear'),
          isNull(integrationMappings.deletedAt),
        ),
      );
  });
}

export async function upsertLinearTeamMapping(
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
          eq(integrationMappings.mappingType, 'project_to_linear'),
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
        mappingType: 'project_to_linear',
        internalId: input.internalId,
        externalId: input.externalId,
        metadata: input.metadata ?? {},
      })
      .returning();
    return row!;
  });
}

export async function upsertTaskFromLinear(
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
    priority: string | null;
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
          eq(tasks.externalSource, 'linear'),
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
      dueDate: null,
      priority: input.priority,
      labels: [],
      milestoneId: null,
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
        externalSource: 'linear',
        ...values,
      })
      .returning();
    return created!;
  });
}

export async function updateLinearMetadata(
  db: Database,
  tenantId: string,
  metadata: LinearIntegrationMetadata,
) {
  const integration = await getLinearIntegration(db, tenantId);
  if (!integration) throw notFound('Linear integration not found');
  await withTenantContext(db, tenantId, async () => {
    await db
      .update(integrations)
      .set({ metadata: toMetadataJson(metadata), updatedAt: new Date() })
      .where(eq(integrations.id, integration.id));
  });
  return metadata;
}
