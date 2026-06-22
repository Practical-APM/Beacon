import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CORE_CRM_ID,
  getAvailableIntegrations,
  getIntegrationCatalogEntry,
  INTEGRATION_CATALOG,
  isConnectableCatalogEntry,
} from './catalog.js';

describe('integration catalog', () => {
  it('includes the default core CRM as available', () => {
    const core = getIntegrationCatalogEntry(DEFAULT_CORE_CRM_ID);
    expect(core?.availability).toBe('available');
    expect(core?.setupRole).toBe('core_crm');
    expect(isConnectableCatalogEntry(core!)).toBe(true);
  });

  it('lists HubSpot as connectable core CRM', () => {
    const hubspot = getIntegrationCatalogEntry('hubspot');
    expect(hubspot?.category).toBe('crm');
    expect(hubspot?.availability).toBe('available');
    expect(isConnectableCatalogEntry(hubspot!)).toBe(true);
  });

  it('lists Dynamics as connectable core CRM', () => {
    const dynamics = getIntegrationCatalogEntry('microsoft_dynamics');
    expect(dynamics?.category).toBe('crm');
    expect(dynamics?.availability).toBe('available');
    expect(isConnectableCatalogEntry(dynamics!)).toBe(true);
  });

  it('lists Pipedrive as connectable core CRM', () => {
    const pipedrive = getIntegrationCatalogEntry('pipedrive');
    expect(pipedrive?.category).toBe('crm');
    expect(pipedrive?.availability).toBe('available');
    expect(isConnectableCatalogEntry(pipedrive!)).toBe(true);
  });

  it('lists Linear as connectable work management integration', () => {
    const linear = getIntegrationCatalogEntry('linear');
    expect(linear?.category).toBe('work_management');
    expect(linear?.availability).toBe('available');
    expect(isConnectableCatalogEntry(linear!)).toBe(true);
  });

  it('keeps available integrations connectable', () => {
    for (const entry of getAvailableIntegrations()) {
      expect(isConnectableCatalogEntry(entry)).toBe(true);
    }
  });

  it('has unique catalog ids', () => {
    const ids = INTEGRATION_CATALOG.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
