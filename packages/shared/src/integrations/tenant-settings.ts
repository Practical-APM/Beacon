import {
  DEFAULT_CORE_CRM_ID,
  getIntegrationCatalogEntry,
  INTEGRATION_CATALOG,
  type IntegrationCatalogId,
  type IntegrationCatalogEntry,
} from './catalog.js';

export interface TenantIntegrationSettings {
  coreCrmId?: IntegrationCatalogId;
}

export type CoreCrmPreferenceOption = {
  id: IntegrationCatalogId;
  name: string;
  description: string;
  availability: IntegrationCatalogEntry['availability'];
  selectable: boolean;
  signals: readonly string[];
};

export function mergeTenantIntegrationSettings(
  raw?: TenantIntegrationSettings | null,
): Required<Pick<TenantIntegrationSettings, 'coreCrmId'>> {
  const coreCrmId = resolveTenantCoreCrmId(raw?.coreCrmId);
  return { coreCrmId };
}

export function resolveTenantCoreCrmId(
  preferred?: IntegrationCatalogId | null,
): IntegrationCatalogId {
  if (!preferred) return DEFAULT_CORE_CRM_ID;
  const entry = getIntegrationCatalogEntry(preferred);
  if (!entry || entry.setupRole !== 'core_crm') return DEFAULT_CORE_CRM_ID;
  return entry.id;
}

export function listCoreCrmPreferenceOptions(): CoreCrmPreferenceOption[] {
  return INTEGRATION_CATALOG.filter((entry) => entry.setupRole === 'core_crm')
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((entry) => ({
      id: entry.id,
      name: entry.name,
      description: entry.description,
      availability: entry.availability,
      selectable: entry.availability === 'available' || entry.availability === 'beta',
      signals: entry.signals,
    }));
}

export function validateCoreCrmPreference(
  coreCrmId: string,
): { ok: true; coreCrmId: IntegrationCatalogId } | { ok: false; error: string } {
  const entry = getIntegrationCatalogEntry(coreCrmId);
  if (!entry) {
    return { ok: false, error: 'Unknown CRM' };
  }
  if (entry.setupRole !== 'core_crm') {
    return { ok: false, error: `${entry.name} is not a core CRM integration` };
  }
  if (entry.availability === 'coming_soon') {
    return { ok: false, error: `${entry.name} is not available yet` };
  }
  return { ok: true, coreCrmId: entry.id };
}
