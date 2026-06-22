import {
  integrationMappings,
  integrationSyncJobs,
  integrations,
  projects,
  slackChannelSignals,
  withTenantContext,
  type Database,
} from '@beacon/db';
import type { SlackIntegrationMetadata } from '@beacon/shared';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { decryptSecret, encryptSecret, getEncryptionKey } from '../../lib/crypto.js';
import { notFound } from '../../lib/errors.js';
import { buildDefaultSlackMetadata, toMetadataJson } from './oauth.js';
import type { SlackCredentials } from './types.js';

function parseMetadata(raw: Record<string, unknown> | null | undefined): SlackIntegrationMetadata {
  const fallback = buildDefaultSlackMetadata('', '', '');
  if (!raw || typeof raw !== 'object') return fallback;
  return {
    ...fallback,
    ...(raw as Partial<SlackIntegrationMetadata>),
    internalDomains: (raw.internalDomains as string[] | undefined) ?? fallback.internalDomains,
    customerDomains: (raw.customerDomains as string[] | undefined) ?? fallback.customerDomains,
    channelsMissingBot: (raw.channelsMissingBot as string[] | undefined) ?? [],
  };
}

export async function getSlackIntegration(db: Database, tenantId: string) {
  return withTenantContext(db, tenantId, async () => {
    const [row] = await db
      .select()
      .from(integrations)
      .where(and(eq(integrations.tenantId, tenantId), eq(integrations.source, 'slack')))
      .limit(1);
    return row ?? null;
  });
}

export async function upsertSlackIntegration(
  db: Database,
  tenantId: string,
  params: {
    credentials: SlackCredentials;
    metadata: SlackIntegrationMetadata;
    status?: 'connected' | 'degraded' | 'disconnected' | 'syncing';
  },
) {
  return withTenantContext(db, tenantId, async () => {
    const encrypted = encryptSecret(JSON.stringify(params.credentials), getEncryptionKey());
    const existing = await getSlackIntegration(db, tenantId);

    if (existing) {
      const [row] = await db
        .update(integrations)
        .set({
          status: params.status ?? 'connected',
          externalOrgId: params.credentials.teamId,
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
        source: 'slack',
        status: params.status ?? 'connected',
        externalOrgId: params.credentials.teamId,
        credentialsEncrypted: encrypted,
        metadata: toMetadataJson(params.metadata),
      })
      .returning();
    return row!;
  });
}

export async function getSlackCredentials(
  db: Database,
  tenantId: string,
): Promise<SlackCredentials | null> {
  const integration = await getSlackIntegration(db, tenantId);
  if (!integration?.credentialsEncrypted) return null;
  const decrypted = decryptSecret(integration.credentialsEncrypted, getEncryptionKey());
  return JSON.parse(decrypted) as SlackCredentials;
}

export async function setSlackIntegrationStatus(
  db: Database,
  tenantId: string,
  status: 'connected' | 'degraded' | 'disconnected' | 'syncing',
  lastError?: string | null,
) {
  const integration = await getSlackIntegration(db, tenantId);
  if (!integration) throw notFound('Slack integration not found');
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

export async function updateSlackMetadata(
  db: Database,
  tenantId: string,
  metadata: SlackIntegrationMetadata,
): Promise<SlackIntegrationMetadata> {
  const integration = await getSlackIntegration(db, tenantId);
  if (!integration) throw notFound('Slack integration not found');
  await withTenantContext(db, tenantId, async () => {
    await db
      .update(integrations)
      .set({ metadata: toMetadataJson(metadata), updatedAt: new Date() })
      .where(eq(integrations.id, integration.id));
  });
  return metadata;
}

export async function disconnectSlack(db: Database, tenantId: string) {
  const integration = await getSlackIntegration(db, tenantId);
  if (!integration) throw notFound('Slack integration not found');
  await withTenantContext(db, tenantId, async () => {
    await db
      .update(integrations)
      .set({
        status: 'disconnected',
        credentialsEncrypted: null,
        externalOrgId: null,
        lastError: null,
        metadata: toMetadataJson(buildDefaultSlackMetadata('', '', '')),
        updatedAt: new Date(),
      })
      .where(eq(integrations.id, integration.id));

    await db
      .update(slackChannelSignals)
      .set({ stale: true, updatedAt: new Date() })
      .where(eq(slackChannelSignals.integrationId, integration.id));
  });
}

export function readSlackMetadata(integration: {
  metadata: Record<string, unknown> | null;
}): SlackIntegrationMetadata {
  return parseMetadata(integration.metadata);
}

export async function listSlackChannelMappings(db: Database, tenantId: string, integrationId: string) {
  return withTenantContext(db, tenantId, async () =>
    db
      .select()
      .from(integrationMappings)
      .where(
        and(
          eq(integrationMappings.tenantId, tenantId),
          eq(integrationMappings.integrationId, integrationId),
          eq(integrationMappings.mappingType, 'project_to_slack_channel'),
          isNull(integrationMappings.deletedAt),
        ),
      ),
  );
}

export async function upsertSlackChannelMapping(
  db: Database,
  tenantId: string,
  integrationId: string,
  input: {
    internalId: string;
    externalId: string;
    metadata?: Record<string, unknown>;
  },
) {
  return withTenantContext(db, tenantId, async () => {
    const existing = await db
      .select()
      .from(integrationMappings)
      .where(
        and(
          eq(integrationMappings.tenantId, tenantId),
          eq(integrationMappings.integrationId, integrationId),
          eq(integrationMappings.mappingType, 'project_to_slack_channel'),
          eq(integrationMappings.externalId, input.externalId),
          isNull(integrationMappings.deletedAt),
        ),
      )
      .limit(1);

    if (existing[0]) {
      const [row] = await db
        .update(integrationMappings)
        .set({
          internalId: input.internalId,
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
        mappingType: 'project_to_slack_channel',
        internalId: input.internalId,
        externalId: input.externalId,
        metadata: input.metadata ?? {},
      })
      .returning();
    return row!;
  });
}

export async function deleteSlackChannelMapping(
  db: Database,
  tenantId: string,
  mappingId: string,
) {
  await withTenantContext(db, tenantId, async () => {
    await db
      .update(integrationMappings)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(integrationMappings.id, mappingId),
          eq(integrationMappings.tenantId, tenantId),
          eq(integrationMappings.mappingType, 'project_to_slack_channel'),
        ),
      );
  });
}

export async function createSlackSyncJob(
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

export async function updateSlackSyncJob(
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

export async function getLatestSlackSyncJob(db: Database, tenantId: string, integrationId: string) {
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

export async function upsertSlackChannelSignal(
  db: Database,
  tenantId: string,
  input: {
    integrationId: string;
    mappingId: string;
    projectId: string;
    channelId: string;
    channelName: string;
    botPresent: boolean;
    botAccessError?: string | null;
    lastCustomerMessageAt?: Date | null;
    lastInternalResponseAt?: Date | null;
    lastActivityAt?: Date | null;
    lastEscalationAt?: Date | null;
    messageSampleCount: number;
    metadata?: Record<string, unknown>;
    stale?: boolean;
  },
) {
  return withTenantContext(db, tenantId, async () => {
    const [existing] = await db
      .select()
      .from(slackChannelSignals)
      .where(
        and(eq(slackChannelSignals.tenantId, tenantId), eq(slackChannelSignals.channelId, input.channelId)),
      )
      .limit(1);

    const values = {
      integrationId: input.integrationId,
      mappingId: input.mappingId,
      projectId: input.projectId,
      channelId: input.channelId,
      channelName: input.channelName,
      botPresent: input.botPresent,
      botAccessError: input.botAccessError ?? null,
      lastCustomerMessageAt: input.lastCustomerMessageAt ?? null,
      lastInternalResponseAt: input.lastInternalResponseAt ?? null,
      lastActivityAt: input.lastActivityAt ?? null,
      lastEscalationAt: input.lastEscalationAt ?? null,
      messageSampleCount: input.messageSampleCount,
      metadata: input.metadata ?? {},
      stale: input.stale ?? false,
      updatedAt: new Date(),
    };

    if (existing) {
      const [row] = await db
        .update(slackChannelSignals)
        .set(values)
        .where(eq(slackChannelSignals.id, existing.id))
        .returning();
      return row!;
    }

    const [row] = await db
      .insert(slackChannelSignals)
      .values({ tenantId, ...values })
      .returning();
    return row!;
  });
}

export async function listSlackChannelSignalsForProject(
  db: Database,
  tenantId: string,
  projectId: string,
) {
  return withTenantContext(db, tenantId, async () =>
    db
      .select()
      .from(slackChannelSignals)
      .where(and(eq(slackChannelSignals.tenantId, tenantId), eq(slackChannelSignals.projectId, projectId))),
  );
}

export async function listSlackChannelSignals(db: Database, tenantId: string, integrationId: string) {
  return withTenantContext(db, tenantId, async () =>
    db
      .select()
      .from(slackChannelSignals)
      .where(
        and(
          eq(slackChannelSignals.tenantId, tenantId),
          eq(slackChannelSignals.integrationId, integrationId),
        ),
      ),
  );
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

export async function findFirstActiveProject(db: Database, tenantId: string) {
  return withTenantContext(db, tenantId, async () => {
    const [row] = await db
      .select()
      .from(projects)
      .where(
        and(eq(projects.tenantId, tenantId), eq(projects.status, 'active'), isNull(projects.deletedAt)),
      )
      .limit(1);
    return row ?? null;
  });
}

export async function getSlackChannelMappingByChannelId(
  db: Database,
  tenantId: string,
  channelId: string,
) {
  return withTenantContext(db, tenantId, async () => {
    const [row] = await db
      .select({ mapping: integrationMappings, signal: slackChannelSignals })
      .from(integrationMappings)
      .leftJoin(
        slackChannelSignals,
        eq(slackChannelSignals.mappingId, integrationMappings.id),
      )
      .where(
        and(
          eq(integrationMappings.tenantId, tenantId),
          eq(integrationMappings.mappingType, 'project_to_slack_channel'),
          eq(integrationMappings.externalId, channelId),
          isNull(integrationMappings.deletedAt),
        ),
      )
      .limit(1);
    return row ?? null;
  });
}
