export const DYNAMICS_OAUTH_SCOPES = [
  'openid',
  'offline_access',
  'https://globaldisco.crm.dynamics.com/user_impersonation',
] as const;

export interface DynamicsFieldMappings {
  opportunityName: string;
  accountExternalId: string;
  accountName: string;
  arrAmount: string;
  goLiveDate: string;
  ownerName: string;
  ownerEmail: string;
  stageName: string;
  lastModified: string;
}

export interface DynamicsIntegrationMetadata {
  orgUrl: string;
  orgId: string;
  fieldMappings: DynamicsFieldMappings;
  implementationStages: string[];
  lastModifiedAt?: string | null;
  mappingComplete: boolean;
  mappingRails?: {
    status: 'healthy' | 'repaired' | 'degraded';
    lastCheckedAt: string | null;
    autoConfigured: boolean;
    repairs: Array<{
      logicalField: string;
      previousSourceField: string;
      resolvedSourceField: string;
      repairedAt: string;
    }>;
    issues: string[];
  };
  syncProgress?: {
    status: 'idle' | 'running' | 'completed' | 'failed';
    recordsProcessed: number;
    recordsTotal: number | null;
    startedAt?: string;
    completedAt?: string;
    error?: string | null;
  };
}

export const DEFAULT_DYNAMICS_FIELD_MAPPINGS: DynamicsFieldMappings = {
  opportunityName: 'name',
  accountExternalId: 'accountId',
  accountName: 'accountName',
  arrAmount: 'amount',
  goLiveDate: 'closedate',
  ownerName: 'ownerName',
  ownerEmail: 'ownerEmail',
  stageName: 'stageName',
  lastModified: 'modifiedon',
};

export const REQUIRED_DYNAMICS_MAPPING_FIELDS: Array<keyof DynamicsFieldMappings> = [
  'opportunityName',
  'accountExternalId',
  'accountName',
  'arrAmount',
  'goLiveDate',
  'ownerEmail',
  'stageName',
];

export function validateDynamicsFieldMappings(
  mappings: Partial<DynamicsFieldMappings>,
): { complete: boolean; missing: string[] } {
  const missing = REQUIRED_DYNAMICS_MAPPING_FIELDS.filter((field) => !mappings[field]?.trim());
  return { complete: missing.length === 0, missing };
}

export function buildDynamicsAuthorizeUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  tenantId: string;
}): string {
  const query = new URLSearchParams({
    client_id: params.clientId,
    response_type: 'code',
    redirect_uri: params.redirectUri,
    response_mode: 'query',
    scope: DYNAMICS_OAUTH_SCOPES.join(' '),
    state: params.state,
  });
  return `https://login.microsoftonline.com/${params.tenantId}/oauth2/v2.0/authorize?${query.toString()}`;
}

export function buildDynamicsTokenUrl(tenantId: string): string {
  return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
}
