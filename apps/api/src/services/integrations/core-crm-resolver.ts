import type { Database } from '@beacon/db';
import type { IntegrationCatalogId } from '@beacon/shared/integrations';
import { getIntegrationCatalogEntry } from '@beacon/shared/integrations';
import { getDynamicsIntegration } from '../dynamics/integration-service.js';
import { runDynamicsMappingHealthCheck } from '../dynamics/field-mapping-rails.js';
import { getDynamicsStatus, startDynamicsSync } from '../dynamics/sync.js';
import { getHubSpotIntegration } from '../hubspot/integration-service.js';
import { runHubSpotMappingHealthCheck } from '../hubspot/field-mapping-rails.js';
import { getHubSpotStatus, startHubSpotSync } from '../hubspot/sync.js';
import { getPipedriveIntegration } from '../pipedrive/integration-service.js';
import { runPipedriveMappingHealthCheck } from '../pipedrive/field-mapping-rails.js';
import { getPipedriveStatus, startPipedriveSync } from '../pipedrive/sync.js';
import { getSalesforceIntegration } from '../salesforce/integration-service.js';
import { getSalesforceStatus } from '../salesforce/sync.js';
import { runSalesforceMappingHealthCheck } from '../salesforce/field-mapping-rails.js';
import { startSalesforceSync } from '../salesforce/sync.js';
import { getTenantCoreCrmId } from './tenant-integration-settings.js';

export type CoreCrmReadinessSnapshot = {
  connected: boolean;
  status: string;
  mappingComplete: boolean;
  lastSyncAt: string | null;
  syncProgress?: {
    recordsProcessed?: number;
    recordsTotal?: number | null;
  } | null;
};

export async function resolveTenantCoreCrmId(
  db: Database,
  tenantId: string,
): Promise<IntegrationCatalogId> {
  return getTenantCoreCrmId(db, tenantId);
}

export async function getCoreCrmReadinessSnapshot(
  db: Database,
  tenantId: string,
  coreCrmId?: IntegrationCatalogId,
): Promise<{
  coreCrmId: IntegrationCatalogId;
  coreCrmName: string;
  snapshot: CoreCrmReadinessSnapshot;
}> {
  const resolvedId = coreCrmId ?? (await getTenantCoreCrmId(db, tenantId));
  const coreCrmName = getIntegrationCatalogEntry(resolvedId)?.name ?? 'CRM';

  if (resolvedId === 'salesforce') {
    const status = await getSalesforceStatus(db, tenantId);
    return {
      coreCrmId: resolvedId,
      coreCrmName,
      snapshot: {
        connected: status.connected,
        status: status.status,
        mappingComplete: Boolean(status.metadata?.mappingComplete),
        lastSyncAt:
          status.lastSyncAt instanceof Date ? status.lastSyncAt.toISOString() : null,
        syncProgress: status.syncProgress ?? null,
      },
    };
  }

  if (resolvedId === 'hubspot') {
    const status = await getHubSpotStatus(db, tenantId);
    return {
      coreCrmId: resolvedId,
      coreCrmName,
      snapshot: {
        connected: status.connected,
        status: status.status,
        mappingComplete: Boolean(status.metadata?.mappingComplete),
        lastSyncAt:
          status.lastSyncAt instanceof Date ? status.lastSyncAt.toISOString() : null,
        syncProgress: status.syncProgress ?? null,
      },
    };
  }

  if (resolvedId === 'microsoft_dynamics') {
    const status = await getDynamicsStatus(db, tenantId);
    return {
      coreCrmId: resolvedId,
      coreCrmName,
      snapshot: {
        connected: status.connected,
        status: status.status,
        mappingComplete: Boolean(status.metadata?.mappingComplete),
        lastSyncAt:
          status.lastSyncAt instanceof Date ? status.lastSyncAt.toISOString() : null,
        syncProgress: status.syncProgress ?? null,
      },
    };
  }

  if (resolvedId === 'pipedrive') {
    const status = await getPipedriveStatus(db, tenantId);
    return {
      coreCrmId: resolvedId,
      coreCrmName,
      snapshot: {
        connected: status.connected,
        status: status.status,
        mappingComplete: Boolean(status.metadata?.mappingComplete),
        lastSyncAt:
          status.lastSyncAt instanceof Date ? status.lastSyncAt.toISOString() : null,
        syncProgress: status.syncProgress ?? null,
      },
    };
  }

  return {
    coreCrmId: resolvedId,
    coreCrmName,
    snapshot: {
      connected: false,
      status: 'disconnected',
      mappingComplete: false,
      lastSyncAt: null,
    },
  };
}

export async function advanceCoreCrmSetup(
  db: Database,
  tenantId: string,
): Promise<string[]> {
  const coreCrmId = await getTenantCoreCrmId(db, tenantId);
  const actionsTaken: string[] = [];

  if (coreCrmId === 'salesforce') {
    const integration = await getSalesforceIntegration(db, tenantId);
    if (integration && integration.status !== 'disconnected') {
      await runSalesforceMappingHealthCheck(db, tenantId);
      actionsTaken.push('Ensured CRM field mappings');

      if (!integration.lastSyncAt && integration.status !== 'syncing') {
        startSalesforceSync(db, tenantId, 'bulk');
        actionsTaken.push('Started CRM import');
      }
    }
    return actionsTaken;
  }

  if (coreCrmId === 'hubspot') {
    const integration = await getHubSpotIntegration(db, tenantId);
    if (integration && integration.status !== 'disconnected') {
      await runHubSpotMappingHealthCheck(db, tenantId);
      actionsTaken.push('Ensured CRM field mappings');

      if (!integration.lastSyncAt && integration.status !== 'syncing') {
        startHubSpotSync(db, tenantId, 'bulk');
        actionsTaken.push('Started CRM import');
      }
    }
    return actionsTaken;
  }

  if (coreCrmId === 'microsoft_dynamics') {
    const integration = await getDynamicsIntegration(db, tenantId);
    if (integration && integration.status !== 'disconnected') {
      await runDynamicsMappingHealthCheck(db, tenantId);
      actionsTaken.push('Ensured CRM field mappings');

      if (!integration.lastSyncAt && integration.status !== 'syncing') {
        startDynamicsSync(db, tenantId, 'bulk');
        actionsTaken.push('Started CRM import');
      }
    }
    return actionsTaken;
  }

  if (coreCrmId === 'pipedrive') {
    const integration = await getPipedriveIntegration(db, tenantId);
    if (integration && integration.status !== 'disconnected') {
      await runPipedriveMappingHealthCheck(db, tenantId);
      actionsTaken.push('Ensured CRM field mappings');

      if (!integration.lastSyncAt && integration.status !== 'syncing') {
        startPipedriveSync(db, tenantId, 'bulk');
        actionsTaken.push('Started CRM import');
      }
    }
    return actionsTaken;
  }

  return actionsTaken;
}
