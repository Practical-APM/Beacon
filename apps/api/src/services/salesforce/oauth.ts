import {
  DEFAULT_IMPLEMENTATION_STAGES,
  DEFAULT_SALESFORCE_FIELD_MAPPINGS,
  getSalesforceLoginHost,
  isProjectCrmDataComplete,
  validateFieldMappings,
  type SalesforceEnvironment,
  type SalesforceFieldMappings,
  type SalesforceIntegrationMetadata,
} from '@beacon/shared';
import type { SalesforceCredentials, SalesforceOpportunityRecord } from './types.js';

export function buildDefaultMetadata(
  environment: SalesforceEnvironment,
  instanceUrl: string,
  orgId: string,
): SalesforceIntegrationMetadata {
  const fieldMappings = { ...DEFAULT_SALESFORCE_FIELD_MAPPINGS };
  const { complete } = validateFieldMappings(fieldMappings);
  return {
    environment,
    instanceUrl,
    orgId,
    fieldMappings,
    implementationStages: [...DEFAULT_IMPLEMENTATION_STAGES],
    mappingComplete: complete,
    lastSystemModstamp: null,
  };
}

export function buildOAuthUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  environment: SalesforceEnvironment;
}): string {
  const host = getSalesforceLoginHost(params.environment);
  const query = new URLSearchParams({
    response_type: 'code',
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    scope: 'api refresh_token offline_access',
    state: params.state,
  });
  return `${host}/services/oauth2/authorize?${query.toString()}`;
}

export async function exchangeAuthorizationCode(params: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  environment: SalesforceEnvironment;
}): Promise<SalesforceCredentials> {
  const host = getSalesforceLoginHost(params.environment);
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: params.code,
    client_id: params.clientId,
    client_secret: params.clientSecret,
    redirect_uri: params.redirectUri,
  });

  const res = await fetch(`${host}/services/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Salesforce token exchange failed: ${detail}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    instance_url: string;
    id: string;
    issued_at: string;
  };

  const orgId = data.id.split('/').pop() ?? data.id;
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    instanceUrl: data.instance_url,
    environment: params.environment,
    orgId,
    issuedAt: data.issued_at,
  };
}

export async function refreshAccessToken(params: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
  environment: SalesforceEnvironment;
}): Promise<SalesforceCredentials> {
  const host = getSalesforceLoginHost(params.environment);
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: params.refreshToken,
    client_id: params.clientId,
    client_secret: params.clientSecret,
  });

  const res = await fetch(`${host}/services/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Salesforce token refresh failed: ${detail}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    instance_url: string;
    id: string;
    issued_at: string;
  };

  const orgId = data.id.split('/').pop() ?? data.id;
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? params.refreshToken,
    instanceUrl: data.instance_url,
    environment: params.environment,
    orgId,
    issuedAt: data.issued_at,
  };
}

export function buildOpportunitySoql(
  mappings: SalesforceFieldMappings,
  stages: string[],
  lastSystemModstamp: string | null | undefined,
  limit = 200,
): string {
  const fields = new Set<string>(['Id', mappings.opportunityName, mappings.accountExternalId]);
  for (const value of Object.values(mappings)) {
    if (value.includes('.')) {
      fields.add(value);
    } else {
      fields.add(value);
    }
  }

  const stageList = stages.map((stage) => `'${stage.replace(/'/g, "\\'")}'`).join(', ');
  const filters = [`StageName IN (${stageList})`, 'IsClosed = false'];

  if (lastSystemModstamp) {
    filters.push(`SystemModstamp > ${lastSystemModstamp}`);
  }

  return `SELECT ${[...fields].join(', ')} FROM Opportunity WHERE ${filters.join(' AND ')} ORDER BY SystemModstamp ASC LIMIT ${limit}`;
}

export function mapOpportunityRecord(
  record: SalesforceOpportunityRecord,
  mappings: SalesforceFieldMappings,
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
  systemModstamp: string | null;
} {
  const accountName = record.Account?.Name?.trim() || 'Unknown Account';
  const ownerEmail = record.Owner?.Email?.trim().toLowerCase() ?? null;
  const goLiveDate = record.CloseDate ? new Date(record.CloseDate) : null;
  const arrAmount =
    typeof record.Amount === 'number' && Number.isFinite(record.Amount)
      ? Math.round(record.Amount)
      : null;

  return {
    opportunityId: record.Id,
    opportunityName: record.Name?.trim() || 'Untitled Opportunity',
    accountId: record.AccountId,
    accountName,
    ownerName: record.Owner?.Name?.trim() ?? null,
    ownerEmail,
    stageName: record.StageName ?? null,
    arrAmount,
    arrCurrency: record.CurrencyIsoCode?.trim() || 'USD',
    goLiveDate: goLiveDate && !Number.isNaN(goLiveDate.getTime()) ? goLiveDate : null,
    dataComplete: isProjectCrmDataComplete({ goLiveDate, arrAmount }),
    systemModstamp: record.SystemModstamp ?? null,
  };
}

export function mergeFieldMappings(
  metadata: SalesforceIntegrationMetadata,
  overrides: Partial<SalesforceFieldMappings>,
): SalesforceIntegrationMetadata {
  const fieldMappings = { ...metadata.fieldMappings, ...overrides };
  const { complete } = validateFieldMappings(fieldMappings);
  return {
    ...metadata,
    fieldMappings,
    mappingComplete: complete,
  };
}
