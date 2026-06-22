import {
  calendarProjectSignals,
  integrationMappings,
  integrationSyncJobs,
  integrations,
  projects,
  withTenantContext,
  type Database,
} from '@beacon/db';
import type { GoogleCalendarIntegrationMetadata } from '@beacon/shared/google-calendar';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { decryptSecret, encryptSecret, getEncryptionKey } from '../../lib/crypto.js';
import { notFound } from '../../lib/errors.js';
import { buildDefaultGoogleCalendarMetadata, toMetadataJson } from './oauth.js';
import type { GoogleCalendarCredentials } from './types.js';

function parseMetadata(raw: Record<string, unknown> | null | undefined): GoogleCalendarIntegrationMetadata {
  const fallback = buildDefaultGoogleCalendarMetadata('', '');
  if (!raw || typeof raw !== 'object') return fallback;
  return {
    ...fallback,
    ...(raw as Partial<GoogleCalendarIntegrationMetadata>),
    internalDomains: (raw.internalDomains as string[] | undefined) ?? fallback.internalDomains,
    customerDomains: (raw.customerDomains as string[] | undefined) ?? fallback.customerDomains,
  };
}

export async function getGoogleCalendarIntegration(db: Database, tenantId: string) {
  return withTenantContext(db, tenantId, async () => {
    const [row] = await db
      .select()
      .from(integrations)
      .where(and(eq(integrations.tenantId, tenantId), eq(integrations.source, 'google_calendar')))
      .limit(1);
    return row ?? null;
  });
}

export async function upsertGoogleCalendarIntegration(
  db: Database,
  tenantId: string,
  params: {
    credentials: GoogleCalendarCredentials;
    metadata: GoogleCalendarIntegrationMetadata;
    status?: 'connected' | 'degraded' | 'disconnected' | 'syncing';
  },
) {
  return withTenantContext(db, tenantId, async () => {
    const encrypted = encryptSecret(JSON.stringify(params.credentials), getEncryptionKey());
    const existing = await getGoogleCalendarIntegration(db, tenantId);

    if (existing) {
      const [row] = await db
        .update(integrations)
        .set({
          status: params.status ?? 'connected',
          externalOrgId: params.credentials.accountEmail,
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
        source: 'google_calendar',
        status: params.status ?? 'connected',
        externalOrgId: params.credentials.accountEmail,
        credentialsEncrypted: encrypted,
        metadata: toMetadataJson(params.metadata),
      })
      .returning();
    return row!;
  });
}

export async function getGoogleCalendarCredentials(
  db: Database,
  tenantId: string,
): Promise<GoogleCalendarCredentials | null> {
  const integration = await getGoogleCalendarIntegration(db, tenantId);
  if (!integration?.credentialsEncrypted) return null;
  const decrypted = decryptSecret(integration.credentialsEncrypted, getEncryptionKey());
  return JSON.parse(decrypted) as GoogleCalendarCredentials;
}

export async function setGoogleCalendarIntegrationStatus(
  db: Database,
  tenantId: string,
  status: 'connected' | 'degraded' | 'disconnected' | 'syncing',
  lastError?: string | null,
) {
  const integration = await getGoogleCalendarIntegration(db, tenantId);
  if (!integration) throw notFound('Google Calendar integration not found');
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

export async function updateGoogleCalendarMetadata(
  db: Database,
  tenantId: string,
  metadata: GoogleCalendarIntegrationMetadata,
) {
  const integration = await getGoogleCalendarIntegration(db, tenantId);
  if (!integration) throw notFound('Google Calendar integration not found');
  await withTenantContext(db, tenantId, async () => {
    await db
      .update(integrations)
      .set({ metadata: toMetadataJson(metadata), updatedAt: new Date() })
      .where(eq(integrations.id, integration.id));
  });
  return metadata;
}

export async function disconnectGoogleCalendar(db: Database, tenantId: string) {
  const integration = await getGoogleCalendarIntegration(db, tenantId);
  if (!integration) throw notFound('Google Calendar integration not found');
  await withTenantContext(db, tenantId, async () => {
    await db
      .update(integrations)
      .set({
        status: 'disconnected',
        credentialsEncrypted: null,
        externalOrgId: null,
        lastError: null,
        metadata: toMetadataJson(buildDefaultGoogleCalendarMetadata('', '')),
        updatedAt: new Date(),
      })
      .where(eq(integrations.id, integration.id));

    await db
      .update(calendarProjectSignals)
      .set({ stale: true, updatedAt: new Date() })
      .where(eq(calendarProjectSignals.integrationId, integration.id));
  });
}

export function readGoogleCalendarMetadata(integration: {
  metadata: Record<string, unknown> | null;
}): GoogleCalendarIntegrationMetadata {
  return parseMetadata(integration.metadata);
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

export async function listGoogleCalendarMappings(db: Database, tenantId: string, integrationId: string) {
  return withTenantContext(db, tenantId, async () =>
    db
      .select()
      .from(integrationMappings)
      .where(
        and(
          eq(integrationMappings.tenantId, tenantId),
          eq(integrationMappings.integrationId, integrationId),
          eq(integrationMappings.mappingType, 'project_to_calendar'),
          isNull(integrationMappings.deletedAt),
        ),
      ),
  );
}

export async function upsertGoogleCalendarMapping(
  db: Database,
  tenantId: string,
  integrationId: string,
  input: { internalId: string; externalId: string; metadata?: Record<string, unknown> },
) {
  return withTenantContext(db, tenantId, async () => {
    const [existing] = await db
      .select()
      .from(integrationMappings)
      .where(
        and(
          eq(integrationMappings.tenantId, tenantId),
          eq(integrationMappings.integrationId, integrationId),
          eq(integrationMappings.mappingType, 'project_to_calendar'),
          eq(integrationMappings.internalId, input.internalId),
          isNull(integrationMappings.deletedAt),
        ),
      )
      .limit(1);

    if (existing) {
      const [row] = await db
        .update(integrationMappings)
        .set({
          externalId: input.externalId,
          metadata: input.metadata ?? {},
          updatedAt: new Date(),
        })
        .where(eq(integrationMappings.id, existing.id))
        .returning();
      return row!;
    }

    const [row] = await db
      .insert(integrationMappings)
      .values({
        tenantId,
        integrationId,
        mappingType: 'project_to_calendar',
        internalId: input.internalId,
        externalId: input.externalId,
        metadata: input.metadata ?? {},
      })
      .returning();
    return row!;
  });
}

export async function listGoogleCalendarSignals(db: Database, tenantId: string, integrationId: string) {
  return withTenantContext(db, tenantId, async () =>
    db
      .select()
      .from(calendarProjectSignals)
      .where(
        and(
          eq(calendarProjectSignals.tenantId, tenantId),
          eq(calendarProjectSignals.integrationId, integrationId),
        ),
      ),
  );
}

export async function upsertGoogleCalendarSignal(
  db: Database,
  tenantId: string,
  input: {
    integrationId: string;
    mappingId: string;
    projectId: string;
    calendarId: string;
    calendarName?: string | null;
    lastMeetingAt?: Date | null;
    lastCustomerMeetingAt?: Date | null;
    meetingCount30d: number;
    metadata?: Record<string, unknown>;
    stale?: boolean;
  },
) {
  return withTenantContext(db, tenantId, async () => {
    const [existing] = await db
      .select()
      .from(calendarProjectSignals)
      .where(
        and(
          eq(calendarProjectSignals.tenantId, tenantId),
          eq(calendarProjectSignals.calendarId, input.calendarId),
        ),
      )
      .limit(1);

    if (existing) {
      const [row] = await db
        .update(calendarProjectSignals)
        .set({
          mappingId: input.mappingId,
          projectId: input.projectId,
          calendarName: input.calendarName ?? null,
          lastMeetingAt: input.lastMeetingAt ?? null,
          lastCustomerMeetingAt: input.lastCustomerMeetingAt ?? null,
          meetingCount30d: input.meetingCount30d,
          metadata: input.metadata ?? {},
          stale: input.stale ?? false,
          updatedAt: new Date(),
        })
        .where(eq(calendarProjectSignals.id, existing.id))
        .returning();
      return row!;
    }

    const [row] = await db
      .insert(calendarProjectSignals)
      .values({
        tenantId,
        integrationId: input.integrationId,
        mappingId: input.mappingId,
        projectId: input.projectId,
        calendarId: input.calendarId,
        calendarName: input.calendarName ?? null,
        lastMeetingAt: input.lastMeetingAt ?? null,
        lastCustomerMeetingAt: input.lastCustomerMeetingAt ?? null,
        meetingCount30d: input.meetingCount30d,
        metadata: input.metadata ?? {},
        stale: input.stale ?? false,
      })
      .returning();
    return row!;
  });
}

export async function createGoogleCalendarSyncJob(
  db: Database,
  tenantId: string,
  integrationId: string,
  jobType: 'bulk' | 'incremental',
) {
  return withTenantContext(db, tenantId, async () => {
    const [job] = await db
      .insert(integrationSyncJobs)
      .values({ tenantId, integrationId, jobType, status: 'running', startedAt: new Date() })
      .returning();
    return job!;
  });
}

export async function updateGoogleCalendarSyncJob(
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

export async function getLatestGoogleCalendarSyncJob(
  db: Database,
  tenantId: string,
  integrationId: string,
) {
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
      .orderBy(desc(integrationSyncJobs.startedAt))
      .limit(1);
    return rows[0] ?? null;
  });
}
