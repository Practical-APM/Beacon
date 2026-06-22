import {
  DEFAULT_PIPEDRIVE_FIELD_MAPPINGS,
  DEFAULT_IMPLEMENTATION_STAGES,
  isProjectCrmDataComplete,
  validatePipedriveFieldMappings,
  type PipedriveFieldMappings,
  type PipedriveIntegrationMetadata,
} from '@beacon/shared';
import type { PipedriveCredentials, PipedriveDealRecord } from './types.js';

export function buildDefaultMetadata(
  companyId: string,
  apiDomain = 'company.pipedrive.com',
): PipedriveIntegrationMetadata {
  const fieldMappings = { ...DEFAULT_PIPEDRIVE_FIELD_MAPPINGS };
  const { complete } = validatePipedriveFieldMappings(fieldMappings);
  return {
    companyId,
    apiDomain,
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
    state: params.state,
  });
  return `https://oauth.pipedrive.com/oauth/authorize?${query.toString()}`;
}

export async function exchangeAuthorizationCode(params: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<PipedriveCredentials> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: params.clientId,
    client_secret: params.clientSecret,
    redirect_uri: params.redirectUri,
    code: params.code,
  });

  const res = await fetch('https://oauth.pipedrive.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Pipedrive token exchange failed: ${detail}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    api_domain?: string;
    expires_in?: number;
  };

  const apiDomain = data.api_domain ?? 'api.pipedrive.com';
  const companyId = apiDomain.split('.')[0] ?? 'pipedrive';

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    companyId,
    apiDomain,
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
  apiDomain: string;
  companyId: string;
}): Promise<PipedriveCredentials> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: params.clientId,
    client_secret: params.clientSecret,
    refresh_token: params.refreshToken,
  });

  const res = await fetch('https://oauth.pipedrive.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Pipedrive token refresh failed: ${detail}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? params.refreshToken,
    companyId: params.companyId,
    apiDomain: params.apiDomain,
    issuedAt: String(Date.now()),
    expiresAt: data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000).toISOString()
      : null,
  };
}

function readField(record: PipedriveDealRecord, field: string): unknown {
  return (record as unknown as Record<string, unknown>)[field];
}

export function mapDealRecord(
  record: PipedriveDealRecord,
  mappings: PipedriveFieldMappings,
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
    companyId: String(readField(record, mappings.companyExternalId) ?? record.org_id),
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
