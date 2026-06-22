export const PIPEDRIVE_OAUTH_SCOPES = ['deals:read', 'contacts:read', 'organizations:read'] as const;

export interface PipedriveFieldMappings {
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

export interface PipedriveIntegrationMetadata {
  companyId: string;
  apiDomain: string;
  fieldMappings: PipedriveFieldMappings;
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

export const DEFAULT_PIPEDRIVE_FIELD_MAPPINGS: PipedriveFieldMappings = {
  dealName: 'title',
  companyExternalId: 'org_id',
  companyName: 'org_name',
  arrAmount: 'value',
  goLiveDate: 'expected_close_date',
  ownerName: 'owner_name',
  ownerEmail: 'owner_email',
  stageName: 'stage_name',
  lastModified: 'update_time',
};

export const REQUIRED_PIPEDRIVE_MAPPING_FIELDS: Array<keyof PipedriveFieldMappings> = [
  'dealName',
  'companyExternalId',
  'companyName',
  'arrAmount',
  'goLiveDate',
  'ownerEmail',
  'stageName',
];

export function validatePipedriveFieldMappings(
  mappings: Partial<PipedriveFieldMappings>,
): { complete: boolean; missing: string[] } {
  const missing = REQUIRED_PIPEDRIVE_MAPPING_FIELDS.filter((field) => !mappings[field]?.trim());
  return { complete: missing.length === 0, missing };
}
