import {
  DEFAULT_DYNAMICS_FIELD_MAPPINGS,
  DEFAULT_IMPLEMENTATION_STAGES,
  buildDynamicsTokenUrl,
  isProjectCrmDataComplete,
  validateDynamicsFieldMappings,
  type DynamicsFieldMappings,
  type DynamicsIntegrationMetadata,
} from '@beacon/shared';
import type { DynamicsCredentials, DynamicsOpportunityRecord } from './types.js';

export function buildDefaultMetadata(orgUrl: string, orgId: string): DynamicsIntegrationMetadata {
  const fieldMappings = { ...DEFAULT_DYNAMICS_FIELD_MAPPINGS };
  const { complete } = validateDynamicsFieldMappings(fieldMappings);
  return {
    orgUrl,
    orgId,
    fieldMappings,
    implementationStages: [...DEFAULT_IMPLEMENTATION_STAGES],
    mappingComplete: complete,
    lastModifiedAt: null,
  };
}

export async function discoverDynamicsOrg(accessToken: string): Promise<{ orgUrl: string; orgId: string }> {
  const res = await fetch('https://globaldisco.crm.dynamics.com/api/discovery/v2.0/Instances', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Dynamics discovery failed: ${detail}`);
  }

  const payload = (await res.json()) as {
    value?: Array<{ Id?: string; ApiUrl?: string; FriendlyName?: string; State?: number }>;
  };

  const instance =
    payload.value?.find((row) => row.State === 0 && row.ApiUrl) ??
    payload.value?.find((row) => row.ApiUrl);

  if (!instance?.ApiUrl) {
    throw new Error('No active Dynamics 365 organization was found for this account');
  }

  return {
    orgUrl: instance.ApiUrl.replace(/\/$/, ''),
    orgId: instance.Id ?? instance.FriendlyName ?? 'dynamics-org',
  };
}

export async function exchangeAuthorizationCode(params: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  azureTenantId: string;
}): Promise<DynamicsCredentials> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: params.clientId,
    client_secret: params.clientSecret,
    redirect_uri: params.redirectUri,
    code: params.code,
  });

  const res = await fetch(buildDynamicsTokenUrl(params.azureTenantId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Dynamics token exchange failed: ${detail}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in?: number;
  };

  const org = await discoverDynamicsOrg(data.access_token);
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    orgUrl: org.orgUrl,
    orgId: org.orgId,
    azureTenantId: params.azureTenantId,
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
  azureTenantId: string;
  orgUrl: string;
  orgId: string;
}): Promise<DynamicsCredentials> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: params.clientId,
    client_secret: params.clientSecret,
    refresh_token: params.refreshToken,
  });

  const res = await fetch(buildDynamicsTokenUrl(params.azureTenantId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Dynamics token refresh failed: ${detail}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? params.refreshToken,
    orgUrl: params.orgUrl,
    orgId: params.orgId,
    azureTenantId: params.azureTenantId,
    issuedAt: String(Date.now()),
    expiresAt: data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000).toISOString()
      : null,
  };
}

function readField(record: DynamicsOpportunityRecord, field: string): unknown {
  return (record as unknown as Record<string, unknown>)[field];
}

export function mapOpportunityRecord(
  record: DynamicsOpportunityRecord,
  mappings: DynamicsFieldMappings,
): {
  opportunityId: string;
  opportunityName: string;
  accountId: string;
  accountName: string;
  ownerName: string | null;
  ownerEmail: string | null;
  stageName: string | null;
  arrAmount: number | null;
  arrCurrency: string;
  goLiveDate: Date | null;
  dataComplete: boolean;
  lastModified: string | null;
} {
  const accountName =
    String(readField(record, mappings.accountName) ?? '').trim() || 'Unknown Account';
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
    opportunityId: record.opportunityid,
    opportunityName:
      String(readField(record, mappings.opportunityName) ?? '').trim() || 'Untitled Opportunity',
    accountId: String(readField(record, mappings.accountExternalId) ?? record.accountId),
    accountName,
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
