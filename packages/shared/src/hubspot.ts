export const HUBSPOT_OAUTH_SCOPES = [
  'crm.objects.deals.read',
  'crm.objects.companies.read',
  'crm.objects.owners.read',
] as const;

export interface HubSpotFieldMappings {
  dealName: string;
  companyExternalId: string;
  companyName: string;
  arrAmount: string;
  goLiveDate: string;
  ownerName: string;
  ownerEmail: string;
  stageName: string;
  lastModified: string;
}

export interface HubSpotIntegrationMetadata {
  portalId: string;
  fieldMappings: HubSpotFieldMappings;
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

export const DEFAULT_HUBSPOT_FIELD_MAPPINGS: HubSpotFieldMappings = {
  dealName: 'dealname',
  companyExternalId: 'companyId',
  companyName: 'companyName',
  arrAmount: 'amount',
  goLiveDate: 'closedate',
  ownerName: 'ownerName',
  ownerEmail: 'ownerEmail',
  stageName: 'dealstage',
  lastModified: 'hs_lastmodifieddate',
};

export const REQUIRED_HUBSPOT_MAPPING_FIELDS: Array<keyof HubSpotFieldMappings> = [
  'dealName',
  'companyExternalId',
  'companyName',
  'arrAmount',
  'goLiveDate',
  'ownerEmail',
  'stageName',
];

export function validateHubSpotFieldMappings(
  mappings: Partial<HubSpotFieldMappings>,
): { complete: boolean; missing: string[] } {
  const missing = REQUIRED_HUBSPOT_MAPPING_FIELDS.filter((field) => !mappings[field]?.trim());
  return { complete: missing.length === 0, missing };
}
