export type SalesforceEnvironment = 'production' | 'sandbox';

export interface SalesforceFieldMappings {
  opportunityName: string;
  accountExternalId: string;
  accountName: string;
  arrAmount: string;
  goLiveDate: string;
  ownerName: string;
  ownerEmail: string;
  stageName: string;
  isClosed: string;
  isWon: string;
  currencyIsoCode: string;
  systemModstamp: string;
}

export interface SalesforceIntegrationMetadata {
  environment: SalesforceEnvironment;
  instanceUrl: string;
  orgId: string;
  fieldMappings: SalesforceFieldMappings;
  implementationStages: string[];
  lastSystemModstamp?: string | null;
  mappingComplete: boolean;
  /** Automatic mapping health — updated on connect and each sync. */
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

export const DEFAULT_SALESFORCE_FIELD_MAPPINGS: SalesforceFieldMappings = {
  opportunityName: 'Name',
  accountExternalId: 'AccountId',
  accountName: 'Account.Name',
  arrAmount: 'Amount',
  goLiveDate: 'CloseDate',
  ownerName: 'Owner.Name',
  ownerEmail: 'Owner.Email',
  stageName: 'StageName',
  isClosed: 'IsClosed',
  isWon: 'IsWon',
  currencyIsoCode: 'CurrencyIsoCode',
  systemModstamp: 'SystemModstamp',
};

export const DEFAULT_IMPLEMENTATION_STAGES = [
  'Qualification',
  'Needs Analysis',
  'Proposal',
  'Negotiation',
  'Implementation',
  'Onboarding',
];

export const REQUIRED_MAPPING_FIELDS: Array<keyof SalesforceFieldMappings> = [
  'opportunityName',
  'accountExternalId',
  'accountName',
  'arrAmount',
  'goLiveDate',
  'ownerEmail',
  'stageName',
];

export function getSalesforceLoginHost(environment: SalesforceEnvironment): string {
  return environment === 'sandbox' ? 'https://test.salesforce.com' : 'https://login.salesforce.com';
}

export function validateFieldMappings(
  mappings: Partial<SalesforceFieldMappings>,
): { complete: boolean; missing: string[] } {
  const missing = REQUIRED_MAPPING_FIELDS.filter((field) => !mappings[field]?.trim());
  return { complete: missing.length === 0, missing };
}
