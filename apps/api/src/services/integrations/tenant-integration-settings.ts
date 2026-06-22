import { tenants } from '@beacon/db';
import type { Database } from '@beacon/db';
import {
  listCoreCrmPreferenceOptions,
  mergeTenantIntegrationSettings,
  validateCoreCrmPreference,
  type CoreCrmPreferenceOption,
  type IntegrationCatalogId,
  type TenantIntegrationSettings,
} from '@beacon/shared/integrations';
import { eq } from 'drizzle-orm';
import { listIntegrations } from '../operational-service.js';

export async function getTenantIntegrationSettings(
  db: Database,
  tenantId: string,
): Promise<Required<Pick<TenantIntegrationSettings, 'coreCrmId'>>> {
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  return mergeTenantIntegrationSettings(
    (tenant?.integrationSettings ?? {}) as TenantIntegrationSettings,
  );
}

export async function getTenantCoreCrmId(
  db: Database,
  tenantId: string,
): Promise<IntegrationCatalogId> {
  const settings = await getTenantIntegrationSettings(db, tenantId);
  return settings.coreCrmId;
}

export async function updateTenantCoreCrmId(
  db: Database,
  tenantId: string,
  coreCrmId: IntegrationCatalogId,
): Promise<Required<Pick<TenantIntegrationSettings, 'coreCrmId'>>> {
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  const current = (tenant?.integrationSettings ?? {}) as TenantIntegrationSettings;
  const nextSettings: TenantIntegrationSettings = {
    ...current,
    coreCrmId,
  };

  await db
    .update(tenants)
    .set({ integrationSettings: nextSettings as Record<string, unknown>, updatedAt: new Date() })
    .where(eq(tenants.id, tenantId));

  return mergeTenantIntegrationSettings(nextSettings);
}

export type CoreCrmPreferenceResponse = {
  coreCrmId: IntegrationCatalogId;
  coreCrmName: string;
  options: CoreCrmPreferenceOption[];
  locked: boolean;
  lockedReason: string | null;
  connectedCoreCrmId: IntegrationCatalogId | null;
};

const CORE_CRM_SOURCES: Partial<Record<IntegrationCatalogId, string>> = {
  salesforce: 'salesforce',
  hubspot: 'hubspot',
  microsoft_dynamics: 'microsoft_dynamics',
  pipedrive: 'pipedrive',
};

export async function getCoreCrmPreference(
  db: Database,
  tenantId: string,
): Promise<CoreCrmPreferenceResponse> {
  const settings = await getTenantIntegrationSettings(db, tenantId);
  const options = listCoreCrmPreferenceOptions();
  const entry = options.find((option) => option.id === settings.coreCrmId);
  const { data: connections } = await listIntegrations(db, tenantId);

  let connectedCoreCrmId: IntegrationCatalogId | null = null;
  for (const option of options) {
    const source = CORE_CRM_SOURCES[option.id];
    if (!source) continue;
    const connection = connections.find((row) => row.source === source);
    if (connection && connection.status !== 'disconnected') {
      connectedCoreCrmId = option.id;
      break;
    }
  }

  const locked = Boolean(
    connectedCoreCrmId && connectedCoreCrmId !== settings.coreCrmId,
  );

  return {
    coreCrmId: settings.coreCrmId,
    coreCrmName: entry?.name ?? 'CRM',
    options,
    locked,
    lockedReason: locked
      ? `Disconnect ${options.find((option) => option.id === connectedCoreCrmId)?.name ?? 'your CRM'} before switching core CRM.`
      : null,
    connectedCoreCrmId,
  };
}

export async function setCoreCrmPreference(
  db: Database,
  tenantId: string,
  coreCrmId: string,
): Promise<CoreCrmPreferenceResponse> {
  const validated = validateCoreCrmPreference(coreCrmId);
  if (!validated.ok) {
    throw new Error(validated.error);
  }

  const current = await getCoreCrmPreference(db, tenantId);
  if (current.connectedCoreCrmId && current.connectedCoreCrmId !== validated.coreCrmId) {
    throw new Error(current.lockedReason ?? 'Disconnect the current CRM before switching.');
  }

  await updateTenantCoreCrmId(db, tenantId, validated.coreCrmId);
  return getCoreCrmPreference(db, tenantId);
}
