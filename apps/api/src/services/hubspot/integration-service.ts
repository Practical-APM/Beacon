import {
  customers,
  integrationSyncJobs,
  integrations,
  projects,
  withTenantContext,
  type Database,
} from '@beacon/db';
import type { HubSpotIntegrationMetadata } from '@beacon/shared';
import { and, desc, eq } from 'drizzle-orm';
import { decryptSecret, encryptSecret, getEncryptionKey } from '../../lib/crypto.js';
import { notFound } from '../../lib/errors.js';
import { buildDefaultMetadata } from './oauth.js';
import type { HubSpotCredentials } from './types.js';

function parseMetadata(raw: Record<string, unknown> | null | undefined): HubSpotIntegrationMetadata {
  const fallback = buildDefaultMetadata('');
  if (!raw || typeof raw !== 'object') return fallback;
  return {
    ...fallback,
    ...(raw as Partial<HubSpotIntegrationMetadata>),
    fieldMappings: {
      ...fallback.fieldMappings,
      ...((raw.fieldMappings as HubSpotIntegrationMetadata['fieldMappings']) ?? {}),
    },
    implementationStages:
      (raw.implementationStages as string[] | undefined) ?? fallback.implementationStages,
  };
}

function toMetadataJson(metadata: HubSpotIntegrationMetadata): Record<string, unknown> {
  return metadata as unknown as Record<string, unknown>;
}

export async function getHubSpotIntegration(db: Database, tenantId: string) {
  return withTenantContext(db, tenantId, async () => {
    const [row] = await db
      .select()
      .from(integrations)
      .where(and(eq(integrations.tenantId, tenantId), eq(integrations.source, 'hubspot')))
      .limit(1);
    return row ?? null;
  });
}

export async function upsertHubSpotIntegration(
  db: Database,
  tenantId: string,
  params: {
    credentials: HubSpotCredentials;
    metadata: HubSpotIntegrationMetadata;
    status?: 'connected' | 'degraded' | 'disconnected' | 'syncing';
  },
) {
  return withTenantContext(db, tenantId, async () => {
    const encrypted = encryptSecret(JSON.stringify(params.credentials), getEncryptionKey());
    const existing = await getHubSpotIntegration(db, tenantId);

    if (existing) {
      const [row] = await db
        .update(integrations)
        .set({
          status: params.status ?? 'connected',
          externalOrgId: params.credentials.portalId,
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
        source: 'hubspot',
        status: params.status ?? 'connected',
        externalOrgId: params.credentials.portalId,
        credentialsEncrypted: encrypted,
        metadata: toMetadataJson(params.metadata),
      })
      .returning();
    return row!;
  });
}

export async function getHubSpotCredentials(
  db: Database,
  tenantId: string,
): Promise<HubSpotCredentials | null> {
  const integration = await getHubSpotIntegration(db, tenantId);
  if (!integration?.credentialsEncrypted) return null;
  const decrypted = decryptSecret(integration.credentialsEncrypted, getEncryptionKey());
  return JSON.parse(decrypted) as HubSpotCredentials;
}

export async function saveHubSpotCredentials(
  db: Database,
  tenantId: string,
  credentials: HubSpotCredentials,
): Promise<void> {
  const integration = await getHubSpotIntegration(db, tenantId);
  if (!integration) throw notFound('HubSpot integration not found');
  const encrypted = encryptSecret(JSON.stringify(credentials), getEncryptionKey());
  await withTenantContext(db, tenantId, async () => {
    await db
      .update(integrations)
      .set({
        credentialsEncrypted: encrypted,
        updatedAt: new Date(),
      })
      .where(eq(integrations.id, integration.id));
  });
}

export async function updateHubSpotMetadata(
  db: Database,
  tenantId: string,
  metadata: HubSpotIntegrationMetadata,
): Promise<HubSpotIntegrationMetadata> {
  const integration = await getHubSpotIntegration(db, tenantId);
  if (!integration) throw notFound('HubSpot integration not found');

  await withTenantContext(db, tenantId, async () => {
    await db
      .update(integrations)
      .set({
        metadata: toMetadataJson(metadata),
        updatedAt: new Date(),
      })
      .where(eq(integrations.id, integration.id));
  });

  return metadata;
}

export async function setIntegrationStatus(
  db: Database,
  tenantId: string,
  status: 'connected' | 'degraded' | 'disconnected' | 'syncing',
  lastError?: string | null,
) {
  const integration = await getHubSpotIntegration(db, tenantId);
  if (!integration) throw notFound('HubSpot integration not found');

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

export async function disconnectHubSpot(db: Database, tenantId: string) {
  const integration = await getHubSpotIntegration(db, tenantId);
  if (!integration) throw notFound('HubSpot integration not found');

  await withTenantContext(db, tenantId, async () => {
    await db
      .update(integrations)
      .set({
        status: 'disconnected',
        credentialsEncrypted: null,
        externalOrgId: null,
        lastError: null,
        metadata: toMetadataJson(buildDefaultMetadata('')),
        updatedAt: new Date(),
      })
      .where(eq(integrations.id, integration.id));
  });
}

export function readIntegrationMetadata(integration: {
  metadata: Record<string, unknown> | null;
}): HubSpotIntegrationMetadata {
  return parseMetadata(integration.metadata);
}

export async function createSyncJob(
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

export async function updateSyncJob(
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

export async function getLatestSyncJob(db: Database, tenantId: string, integrationId: string) {
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

export async function upsertCustomerFromHubSpot(
  db: Database,
  tenantId: string,
  companyId: string,
  companyName: string,
) {
  return withTenantContext(db, tenantId, async () => {
    const [existing] = await db
      .select()
      .from(customers)
      .where(
        and(
          eq(customers.tenantId, tenantId),
          eq(customers.externalSource, 'hubspot'),
          eq(customers.externalId, companyId),
        ),
      )
      .limit(1);

    if (existing) {
      if (existing.name !== companyName) {
        const [updated] = await db
          .update(customers)
          .set({ name: companyName, updatedAt: new Date() })
          .where(eq(customers.id, existing.id))
          .returning();
        return updated!;
      }
      return existing;
    }

    const [created] = await db
      .insert(customers)
      .values({
        tenantId,
        externalId: companyId,
        externalSource: 'hubspot',
        name: companyName,
      })
      .returning();
    return created!;
  });
}

export async function upsertProjectFromHubSpot(
  db: Database,
  tenantId: string,
  customerId: string,
  record: {
    dealId: string;
    dealName: string;
    ownerName: string | null;
    ownerEmail: string | null;
    arrAmount: number | null;
    arrCurrency: string;
    goLiveDate: Date | null;
    dataComplete: boolean;
  },
) {
  return withTenantContext(db, tenantId, async () => {
    const [existing] = await db
      .select()
      .from(projects)
      .where(
        and(
          eq(projects.tenantId, tenantId),
          eq(projects.externalSource, 'hubspot'),
          eq(projects.externalId, record.dealId),
        ),
      )
      .limit(1);

    const values = {
      name: record.dealName,
      ownerName: record.ownerName,
      ownerEmail: record.ownerEmail,
      arrAmount: record.arrAmount,
      arrCurrency: record.arrCurrency,
      targetGoLiveDate: record.goLiveDate,
      dataComplete: record.dataComplete,
      updatedAt: new Date(),
    };

    if (existing) {
      const [updated] = await db
        .update(projects)
        .set(values)
        .where(eq(projects.id, existing.id))
        .returning();
      return updated!;
    }

    const [created] = await db
      .insert(projects)
      .values({
        tenantId,
        customerId,
        externalId: record.dealId,
        externalSource: 'hubspot',
        status: 'active',
        ...values,
      })
      .returning();
    return created!;
  });
}
