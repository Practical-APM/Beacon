import type { DynamicsFieldMappings } from '../dynamics.js';
import type { HubSpotFieldMappings } from '../hubspot.js';
import type { PipedriveFieldMappings } from '../pipedrive.js';
import type { SalesforceFieldMappings } from '../salesforce.js';

export type MappingRailsStatus = 'healthy' | 'repaired' | 'degraded';

export type MappingRailRepair = {
  logicalField: string;
  previousSourceField: string;
  resolvedSourceField: string;
  repairedAt: string;
};

export type MappingRailsState = {
  status: MappingRailsStatus;
  lastCheckedAt: string | null;
  autoConfigured: boolean;
  repairs: MappingRailRepair[];
  issues: string[];
};

/** Alternate Salesforce API field names per logical Beacon attribute. */
export const SALESFORCE_FIELD_ALIASES: Record<keyof SalesforceFieldMappings, readonly string[]> = {
  opportunityName: ['Name', 'OpportunityName'],
  accountExternalId: ['AccountId'],
  accountName: ['Account.Name', 'Account.Name__c'],
  arrAmount: ['Amount', 'ARR__c', 'Annual_Recurring_Revenue__c'],
  goLiveDate: ['CloseDate', 'Go_Live_Date__c', 'Target_Go_Live__c'],
  ownerName: ['Owner.Name'],
  ownerEmail: ['Owner.Email'],
  stageName: ['StageName'],
  isClosed: ['IsClosed'],
  isWon: ['IsWon'],
  currencyIsoCode: ['CurrencyIsoCode'],
  systemModstamp: ['SystemModstamp', 'LastModifiedDate'],
};

export function collectSalesforceSoqlFields(
  mappings: SalesforceFieldMappings,
): Set<string> {
  const fields = new Set<string>();
  for (const value of Object.values(mappings)) {
    fields.add(value.includes('.') ? value.split('.')[0]! : value);
  }
  return fields;
}

export function healFlatFieldMappings<T extends Record<string, string>>(
  mappings: T,
  aliases: Record<keyof T, readonly string[]>,
  availableFields: Set<string>,
  options?: { skip?: ReadonlyArray<keyof T> },
): {
  mappings: T;
  repairs: MappingRailRepair[];
  issues: string[];
} {
  const next = { ...mappings };
  const repairs: MappingRailRepair[] = [];
  const issues: string[] = [];
  const now = new Date().toISOString();
  const skip = new Set(options?.skip ?? []);

  for (const [logicalField, fieldAliases] of Object.entries(aliases) as Array<
    [keyof T, readonly string[]]
  >) {
    if (skip.has(logicalField)) continue;

    const current = next[logicalField];
    if (!current) {
      issues.push(`Missing source field for ${String(logicalField)}`);
      continue;
    }
    if (availableFields.has(current)) continue;

    const replacement = fieldAliases.find((alias) => availableFields.has(alias));
    if (replacement && replacement !== current) {
      repairs.push({
        logicalField: String(logicalField),
        previousSourceField: current,
        resolvedSourceField: replacement,
        repairedAt: now,
      });
      next[logicalField] = replacement as T[keyof T];
      continue;
    }

    issues.push(
      `Missing source field for ${String(logicalField)} (tried ${fieldAliases.join(', ')})`,
    );
  }

  return { mappings: next, repairs, issues };
}

export const HUBSPOT_FIELD_ALIASES: Record<keyof HubSpotFieldMappings, readonly string[]> = {
  dealName: ['dealname', 'hs_deal_name'],
  companyExternalId: ['companyId'],
  companyName: ['companyName'],
  arrAmount: ['amount', 'hs_acv', 'annualrecurringrevenue'],
  goLiveDate: ['closedate', 'go_live_date'],
  ownerName: ['ownerName', 'hubspot_owner_id'],
  ownerEmail: ['ownerEmail'],
  stageName: ['dealstage'],
  lastModified: ['hs_lastmodifieddate'],
};

export const DYNAMICS_FIELD_ALIASES: Record<keyof DynamicsFieldMappings, readonly string[]> = {
  opportunityName: ['name'],
  accountExternalId: ['accountId'],
  accountName: ['accountName'],
  arrAmount: ['amount', 'estimatedvalue'],
  goLiveDate: ['closedate', 'estimatedclosedate'],
  ownerName: ['ownerName'],
  ownerEmail: ['ownerEmail'],
  stageName: ['stageName', 'statuscodename'],
  lastModified: ['modifiedon'],
};

export function healHubSpotFieldMappings(
  mappings: HubSpotFieldMappings,
  availableFields: Set<string>,
): {
  mappings: HubSpotFieldMappings;
  repairs: MappingRailRepair[];
  issues: string[];
} {
  return healFlatFieldMappings(
    { ...mappings },
    HUBSPOT_FIELD_ALIASES,
    availableFields,
    { skip: ['companyExternalId', 'companyName'] },
  );
}

export function healDynamicsFieldMappings(
  mappings: DynamicsFieldMappings,
  availableFields: Set<string>,
): {
  mappings: DynamicsFieldMappings;
  repairs: MappingRailRepair[];
  issues: string[];
} {
  return healFlatFieldMappings(
    { ...mappings },
    DYNAMICS_FIELD_ALIASES,
    availableFields,
    { skip: ['accountExternalId', 'accountName'] },
  );
}

export const PIPEDRIVE_FIELD_ALIASES: Record<keyof PipedriveFieldMappings, readonly string[]> = {
  dealName: ['title', 'deal_title'],
  companyExternalId: ['org_id'],
  companyName: ['org_name'],
  arrAmount: ['value', 'amount'],
  goLiveDate: ['expected_close_date', 'close_date'],
  ownerName: ['owner_name'],
  ownerEmail: ['owner_email'],
  stageName: ['stage_name', 'stage_id'],
  lastModified: ['update_time', 'last_activity_date'],
};

export function healPipedriveFieldMappings(
  mappings: PipedriveFieldMappings,
  availableFields: Set<string>,
): {
  mappings: PipedriveFieldMappings;
  repairs: MappingRailRepair[];
  issues: string[];
} {
  return healFlatFieldMappings(
    { ...mappings },
    PIPEDRIVE_FIELD_ALIASES,
    availableFields,
    { skip: ['companyExternalId', 'companyName'] },
  ) as {
    mappings: PipedriveFieldMappings;
    repairs: MappingRailRepair[];
    issues: string[];
  };
}

export function healSalesforceFieldMappings(
  mappings: SalesforceFieldMappings,
  availableTopLevelFields: Set<string>,
): {
  mappings: SalesforceFieldMappings;
  repairs: MappingRailRepair[];
  issues: string[];
} {
  const next = { ...mappings };
  const repairs: MappingRailRepair[] = [];
  const issues: string[] = [];
  const now = new Date().toISOString();

  for (const [logicalField, aliases] of Object.entries(SALESFORCE_FIELD_ALIASES) as Array<
    [keyof SalesforceFieldMappings, readonly string[]]
  >) {
    const current = next[logicalField];
    const currentRoot = current.includes('.') ? current.split('.')[0]! : current;
    if (availableTopLevelFields.has(currentRoot)) continue;

    const replacement = aliases.find((alias) => {
      const root = alias.includes('.') ? alias.split('.')[0]! : alias;
      return availableTopLevelFields.has(root);
    });

    if (replacement && replacement !== current) {
      repairs.push({
        logicalField,
        previousSourceField: current,
        resolvedSourceField: replacement,
        repairedAt: now,
      });
      next[logicalField] = replacement;
      continue;
    }

    issues.push(`Missing source field for ${logicalField} (tried ${aliases.join(', ')})`);
  }

  return { mappings: next, repairs, issues };
}

export function buildMappingRailsState(params: {
  previous?: MappingRailsState | null;
  autoConfigured: boolean;
  repairs: MappingRailRepair[];
  issues: string[];
}): MappingRailsState {
  const mergedRepairs = [...(params.previous?.repairs ?? []), ...params.repairs].slice(-20);
  const status: MappingRailsStatus =
    params.issues.length > 0 ? 'degraded' : params.repairs.length > 0 ? 'repaired' : 'healthy';

  return {
    status,
    lastCheckedAt: new Date().toISOString(),
    autoConfigured: params.autoConfigured,
    repairs: mergedRepairs,
    issues: params.issues,
  };
}

/** Minimum confidence to auto-apply project/channel suggestions without user action. */
export const AUTO_MAP_CONFIDENCE_THRESHOLD = 50;
