import type { Database } from '@beacon/db';
import {
  getCatalogCategories,
  getIntegrationsByCategory,
  INTEGRATION_CATEGORY_LABELS,
  type IntegrationAvailability,
  type IntegrationCatalogEntry,
} from '@beacon/shared/integrations';
import type { IntegrationSource } from '@beacon/shared/constants';
import { listIntegrations } from './operational-service.js';
import { getTenantCoreCrmId } from './integrations/tenant-integration-settings.js';

export type CatalogIntegrationStatus = {
  id: string;
  name: string;
  category: IntegrationCatalogEntry['category'];
  categoryLabel: string;
  availability: IntegrationAvailability;
  setupRole: IntegrationCatalogEntry['setupRole'];
  description: string;
  signals: readonly string[];
  anchor?: string;
  connectPath?: string;
  sortOrder: number;
  status: 'connected' | 'degraded' | 'disconnected' | 'syncing' | 'not_applicable';
  connected: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
};

export type IntegrationCatalogResponse = {
  defaultCoreCrmId: string;
  categories: Array<{
    id: IntegrationCatalogEntry['category'];
    label: string;
    integrations: CatalogIntegrationStatus[];
  }>;
};

const LIVE_SOURCES = new Set<IntegrationSource>([
  'salesforce',
  'hubspot',
  'microsoft_dynamics',
  'pipedrive',
  'jira',
  'linear',
  'slack',
  'google_calendar',
]);

export async function getIntegrationCatalog(
  db: Database,
  tenantId: string,
): Promise<IntegrationCatalogResponse> {
  const { data: connections } = await listIntegrations(db, tenantId);
  const bySource = new Map(connections.map((row) => [row.source as IntegrationSource, row]));

  const categories = getCatalogCategories().map((categoryId) => ({
    id: categoryId,
    label: INTEGRATION_CATEGORY_LABELS[categoryId],
    integrations: getIntegrationsByCategory(categoryId).map((entry) => {
      const isLive = LIVE_SOURCES.has(entry.id as IntegrationSource);
      const connection = isLive ? bySource.get(entry.id as IntegrationSource) : undefined;

      return {
        id: entry.id,
        name: entry.name,
        category: entry.category,
        categoryLabel: INTEGRATION_CATEGORY_LABELS[entry.category],
        availability: entry.availability,
        setupRole: entry.setupRole,
        description: entry.description,
        signals: entry.signals,
        anchor: entry.anchor,
        connectPath: entry.connectPath,
        sortOrder: entry.sortOrder,
        status: !isLive
          ? ('not_applicable' as const)
          : ((connection?.status as CatalogIntegrationStatus['status']) ?? 'disconnected'),
        connected: connection?.status === 'connected' || connection?.status === 'syncing',
        lastSyncAt: connection?.lastSyncAt
          ? connection.lastSyncAt instanceof Date
            ? connection.lastSyncAt.toISOString()
            : String(connection.lastSyncAt)
          : null,
        lastError: connection?.lastError ?? null,
      };
    }),
  }));

  const defaultCoreCrmId = await getTenantCoreCrmId(db, tenantId);

  return {
    defaultCoreCrmId,
    categories,
  };
}
