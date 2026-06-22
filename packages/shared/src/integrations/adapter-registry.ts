import type { IntegrationSource } from '../constants.js';
import {
  CATALOG_CONNECT_PATHS,
  type IntegrationCatalogId,
} from './catalog.js';

/** Capabilities each integration adapter can expose — used to drive UI and setup flows. */
export type IntegrationAdapterCapabilities = {
  oauth: boolean;
  mockConnect: boolean;
  fieldMappings: boolean;
  bulkSync: boolean;
  webhookEvents: boolean;
};

export type IntegrationAdapterRegistration = {
  catalogId: IntegrationCatalogId;
  /** Live API route segment under /v1/integrations/{apiPath}. */
  apiPath: string;
  /** DB integration_source value when persisted. */
  source?: IntegrationSource;
  capabilities: IntegrationAdapterCapabilities;
};

/**
 * Registry of shipped integration adapters.
 * Adding a new CRM or tool: register here, add catalog entry, implement API routes.
 */
export const INTEGRATION_ADAPTER_REGISTRY: readonly IntegrationAdapterRegistration[] = [
  {
    catalogId: 'salesforce',
    apiPath: 'salesforce',
    source: 'salesforce',
    capabilities: {
      oauth: true,
      mockConnect: true,
      fieldMappings: true,
      bulkSync: true,
      webhookEvents: false,
    },
  },
  {
    catalogId: 'hubspot',
    apiPath: 'hubspot',
    source: 'hubspot',
    capabilities: {
      oauth: true,
      mockConnect: true,
      fieldMappings: true,
      bulkSync: true,
      webhookEvents: false,
    },
  },
  {
    catalogId: 'microsoft_dynamics',
    apiPath: 'microsoft-dynamics',
    source: 'microsoft_dynamics',
    capabilities: {
      oauth: true,
      mockConnect: true,
      fieldMappings: true,
      bulkSync: true,
      webhookEvents: false,
    },
  },
  {
    catalogId: 'pipedrive',
    apiPath: 'pipedrive',
    source: 'pipedrive',
    capabilities: {
      oauth: true,
      mockConnect: true,
      fieldMappings: true,
      bulkSync: true,
      webhookEvents: false,
    },
  },
  {
    catalogId: 'jira',
    apiPath: 'jira',
    source: 'jira',
    capabilities: {
      oauth: true,
      mockConnect: true,
      fieldMappings: true,
      bulkSync: true,
      webhookEvents: false,
    },
  },
  {
    catalogId: 'linear',
    apiPath: 'linear',
    source: 'linear',
    capabilities: {
      oauth: true,
      mockConnect: true,
      fieldMappings: true,
      bulkSync: true,
      webhookEvents: false,
    },
  },
  {
    catalogId: 'slack',
    apiPath: 'slack',
    source: 'slack',
    capabilities: {
      oauth: true,
      mockConnect: true,
      fieldMappings: true,
      bulkSync: false,
      webhookEvents: true,
    },
  },
  {
    catalogId: 'google_calendar',
    apiPath: 'google-calendar',
    source: 'google_calendar',
    capabilities: {
      oauth: true,
      mockConnect: true,
      fieldMappings: false,
      bulkSync: false,
      webhookEvents: false,
    },
  },
] as const;

export function getIntegrationAdapter(
  catalogId: IntegrationCatalogId,
): IntegrationAdapterRegistration | undefined {
  return INTEGRATION_ADAPTER_REGISTRY.find((entry) => entry.catalogId === catalogId);
}

export function getConnectApiPath(catalogId: IntegrationCatalogId): string | undefined {
  return CATALOG_CONNECT_PATHS[catalogId] ?? getIntegrationAdapter(catalogId)?.apiPath;
}

export function listConnectableAdapters(): IntegrationAdapterRegistration[] {
  return INTEGRATION_ADAPTER_REGISTRY.filter((entry) => entry.capabilities.oauth);
}
