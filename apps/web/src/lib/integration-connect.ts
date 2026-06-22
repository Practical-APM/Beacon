import type { ApiFetch } from '@/lib/demo-setup';
import {
  CATALOG_CONNECT_PATHS,
  type IntegrationCatalogId,
} from '@beacon/shared/integrations';

type ConnectUrlResponse = {
  connectUrl: string | null;
  mockMode: boolean;
  message?: string;
};

export type IntegrationConnectSource =
  | 'salesforce'
  | 'hubspot'
  | 'microsoft_dynamics'
  | 'pipedrive'
  | 'jira'
  | 'linear'
  | 'slack'
  | 'google_calendar';

const LEGACY_SOURCE_PATH: Record<IntegrationConnectSource, string> = {
  salesforce: 'salesforce',
  hubspot: 'hubspot',
  microsoft_dynamics: 'microsoft-dynamics',
  pipedrive: 'pipedrive',
  jira: 'jira',
  linear: 'linear',
  slack: 'slack',
  google_calendar: 'google-calendar',
};

export async function fetchIntegrationConnectAvailability(
  apiFetch: ApiFetch,
  path: string,
): Promise<{ available: boolean; mockMode: boolean; message?: string }> {
  const response = (await apiFetch(`/v1/integrations/${path}/connect-url`)) as ConnectUrlResponse;
  return {
    available: Boolean(response.connectUrl || response.mockMode),
    mockMode: Boolean(response.mockMode),
    message: response.message,
  };
}

/**
 * Connect an integration using OAuth when configured, otherwise mock-connect in dev.
 */
export async function connectIntegration(
  apiFetch: ApiFetch,
  source: IntegrationConnectSource,
  options?: { environment?: 'sandbox' | 'production' },
): Promise<'redirected' | 'mock-connected'> {
  const path = LEGACY_SOURCE_PATH[source];
  return connectByApiPath(apiFetch, path, options);
}

/** Catalog-driven connect — resolves API path from shared integration catalog. */
export async function connectCatalogIntegration(
  apiFetch: ApiFetch,
  catalogId: IntegrationCatalogId,
  options?: { environment?: 'sandbox' | 'production' },
): Promise<'redirected' | 'mock-connected'> {
  const path = CATALOG_CONNECT_PATHS[catalogId];
  if (!path) {
    throw new Error(`${catalogId} is not available to connect yet`);
  }
  return connectByApiPath(apiFetch, path, options);
}

async function connectByApiPath(
  apiFetch: ApiFetch,
  path: string,
  options?: { environment?: 'sandbox' | 'production' },
): Promise<'redirected' | 'mock-connected'> {
  const query = path === 'salesforce' ? `?environment=${options?.environment ?? 'sandbox'}` : '';
  const response = (await apiFetch(
    `/v1/integrations/${path}/connect-url${query}`,
  )) as ConnectUrlResponse;

  if (response.connectUrl) {
    window.location.href = response.connectUrl;
    return 'redirected';
  }

  if (!response.mockMode) {
    throw new Error(response.message ?? 'Integration OAuth is not configured for this environment');
  }

  const body =
    path === 'salesforce'
      ? JSON.stringify({ environment: options?.environment ?? 'sandbox' })
      : JSON.stringify({});

  await apiFetch(`/v1/integrations/${path}/mock-connect`, {
    method: 'POST',
    body,
  });

  return 'mock-connected';
}
