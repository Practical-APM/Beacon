import {
  CATALOG_CONNECT_PATHS,
  DEFAULT_CORE_CRM_ID,
  getIntegrationCatalogEntry,
  type IntegrationCatalogId,
} from '@beacon/shared/integrations';

export type ApiFetch = (path: string, init?: RequestInit) => Promise<unknown>;

export type DemoSetupPhase = 'core_crm' | 'jira' | 'slack' | 'sync' | 'done';

export function getDemoPhaseLabel(phase: DemoSetupPhase, coreCrmName = 'CRM'): string {
  switch (phase) {
    case 'core_crm':
      return `Connecting ${coreCrmName}…`;
    case 'jira':
      return 'Connecting Jira…';
    case 'slack':
      return 'Connecting Slack…';
    case 'sync':
      return 'Starting initial sync…';
    case 'done':
      return 'Redirecting to dashboard…';
  }
}

export async function runDemoSetup(
  apiFetch: ApiFetch,
  onProgress?: (phase: DemoSetupPhase) => void,
  coreCrmId: IntegrationCatalogId = DEFAULT_CORE_CRM_ID,
): Promise<void> {
  const connectPath = CATALOG_CONNECT_PATHS[coreCrmId];
  if (!connectPath) {
    const name = getIntegrationCatalogEntry(coreCrmId)?.name ?? coreCrmId;
    throw new Error(`Demo setup is not supported for ${name}`);
  }

  onProgress?.('core_crm');
  await apiFetch(`/v1/integrations/${connectPath}/mock-connect`, {
    method: 'POST',
    body: JSON.stringify(coreCrmId === 'salesforce' ? { environment: 'sandbox' } : {}),
  });

  onProgress?.('jira');
  await apiFetch('/v1/integrations/jira/mock-connect', {
    method: 'POST',
    body: JSON.stringify({}),
  });

  onProgress?.('slack');
  await apiFetch('/v1/integrations/slack/mock-connect', {
    method: 'POST',
    body: JSON.stringify({}),
  });

  onProgress?.('sync');
  await apiFetch(`/v1/integrations/${connectPath}/sync`, {
    method: 'POST',
    body: JSON.stringify({ jobType: 'bulk', async: true }),
  });

  onProgress?.('done');
}
