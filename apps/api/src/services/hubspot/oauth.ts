import {
  DEFAULT_HUBSPOT_FIELD_MAPPINGS,
  DEFAULT_IMPLEMENTATION_STAGES,
  HUBSPOT_OAUTH_SCOPES,
  isProjectCrmDataComplete,
  validateHubSpotFieldMappings,
  type HubSpotFieldMappings,
  type HubSpotIntegrationMetadata,
} from '@beacon/shared';
import type { HubSpotCredentials, HubSpotDealRecord } from './types.js';

export function buildDefaultMetadata(portalId: string): HubSpotIntegrationMetadata {
  const fieldMappings = { ...DEFAULT_HUBSPOT_FIELD_MAPPINGS };
  const { complete } = validateHubSpotFieldMappings(fieldMappings);
  return {
    portalId,
    fieldMappings,
    implementationStages: [...DEFAULT_IMPLEMENTATION_STAGES],
    mappingComplete: complete,
    lastModifiedAt: null,
  };
}

export function buildOAuthUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const query = new URLSearchParams({
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    scope: HUBSPOT_OAUTH_SCOPES.join(' '),
    state: params.state,
  });
  return `https://app.hubspot.com/oauth/authorize?${query.toString()}`;
}

export async function fetchAccessTokenMetadata(accessToken: string): Promise<{
  hubId: string;
  hubDomain: string;
}> {
  const res = await fetch(`https://api.hubapi.com/oauth/v1/access-tokens/${accessToken}`);
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`HubSpot token metadata failed: ${detail}`);
  }
  const data = (await res.json()) as { hub_id?: number; hub_domain?: string };
  return {
    hubId: String(data.hub_id ?? ''),
    hubDomain: data.hub_domain ?? '',
  };
}

export async function exchangeAuthorizationCode(params: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<HubSpotCredentials> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: params.clientId,
    client_secret: params.clientSecret,
    redirect_uri: params.redirectUri,
    code: params.code,
  });

  const res = await fetch('https://api.hubapi.com/oauth/v1/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`HubSpot token exchange failed: ${detail}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in?: number;
  };

  const metadata = await fetchAccessTokenMetadata(data.access_token);
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    portalId: metadata.hubId,
    issuedAt: String(Date.now()),
    expiresAt: data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000).toISOString()
      : null,
  };
}

export async function refreshAccessToken(params: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}): Promise<HubSpotCredentials> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: params.clientId,
    client_secret: params.clientSecret,
    refresh_token: params.refreshToken,
  });

  const res = await fetch('https://api.hubapi.com/oauth/v1/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`HubSpot token refresh failed: ${detail}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };

  const metadata = await fetchAccessTokenMetadata(data.access_token);
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? params.refreshToken,
    portalId: metadata.hubId,
    issuedAt: String(Date.now()),
    expiresAt: data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000).toISOString()
      : null,
  };
}

function readField(record: HubSpotDealRecord, field: string): unknown {
  return (record as unknown as Record<string, unknown>)[field];
}

export function mapDealRecord(
  record: HubSpotDealRecord,
  mappings: HubSpotFieldMappings,
): {
  dealId: string;
  dealName: string;
  companyId: string;
  companyName: string;
  ownerName: string | null;
  ownerEmail: string | null;
  stageName: string | null;
  arrAmount: number | null;
  arrCurrency: string;
  goLiveDate: Date | null;
  dataComplete: boolean;
  lastModified: string | null;
} {
  const companyName =
    String(readField(record, mappings.companyName) ?? '').trim() || 'Unknown Company';
  const ownerEmail =
    String(readField(record, mappings.ownerEmail) ?? '')
      .trim()
      .toLowerCase() || null;
  const closeRaw = readField(record, mappings.goLiveDate);
  const goLiveDate = closeRaw ? new Date(String(closeRaw)) : null;
  const amountRaw = readField(record, mappings.arrAmount);
  const arrAmount =
    typeof amountRaw === 'number' && Number.isFinite(amountRaw)
      ? Math.round(amountRaw)
      : typeof amountRaw === 'string' && amountRaw.trim()
        ? Math.round(Number(amountRaw))
        : null;

  return {
    dealId: record.id,
    dealName: String(readField(record, mappings.dealName) ?? '').trim() || 'Untitled Deal',
    companyId: String(readField(record, mappings.companyExternalId) ?? record.companyId),
    companyName,
    ownerName: String(readField(record, mappings.ownerName) ?? '').trim() || null,
    ownerEmail,
    stageName: String(readField(record, mappings.stageName) ?? '').trim() || null,
    arrAmount: arrAmount !== null && Number.isFinite(arrAmount) ? arrAmount : null,
    arrCurrency: 'USD',
    goLiveDate: goLiveDate && !Number.isNaN(goLiveDate.getTime()) ? goLiveDate : null,
    dataComplete: isProjectCrmDataComplete({ goLiveDate, arrAmount }),
    lastModified: String(readField(record, mappings.lastModified) ?? '') || null,
  };
}

export function mergeFieldMappings(
  metadata: HubSpotIntegrationMetadata,
  overrides: Partial<HubSpotFieldMappings>,
): HubSpotIntegrationMetadata {
  const fieldMappings = { ...metadata.fieldMappings, ...overrides };
  const { complete } = validateHubSpotFieldMappings(fieldMappings);
  return {
    ...metadata,
    fieldMappings,
    mappingComplete: complete,
  };
}
