import type { Database } from '@beacon/db';
import {
  DEFAULT_SALESFORCE_FIELD_MAPPINGS,
  validateFieldMappings,
  type SalesforceIntegrationMetadata,
} from '@beacon/shared';
import {
  buildMappingRailsState,
  collectSalesforceSoqlFields,
  healSalesforceFieldMappings,
} from '@beacon/shared/integrations';
import { env } from '../../env.js';
import { isMockAccessToken } from '../../lib/mock-integration.js';
import { SalesforceClient } from './client.js';
import {
  getSalesforceCredentials,
  readIntegrationMetadata,
  saveSalesforceCredentials,
  updateSalesforceMetadata,
} from './integration-service.js';
import { refreshAccessToken } from './oauth.js';
import type { SalesforceCredentials } from './types.js';

/** Standard Opportunity fields available in mock mode and typical Salesforce orgs. */
const KNOWN_OPPORTUNITY_FIELDS = new Set([
  'Id',
  'Name',
  'AccountId',
  'Account',
  'Amount',
  'CloseDate',
  'Owner',
  'StageName',
  'IsClosed',
  'IsWon',
  'CurrencyIsoCode',
  'SystemModstamp',
  'LastModifiedDate',
]);

export function ensureSalesforceAutoMappings(
  metadata: SalesforceIntegrationMetadata,
): SalesforceIntegrationMetadata {
  const fieldMappings = {
    ...DEFAULT_SALESFORCE_FIELD_MAPPINGS,
    ...metadata.fieldMappings,
  };
  const { complete } = validateFieldMappings(fieldMappings);

  return {
    ...metadata,
    fieldMappings,
    mappingComplete: complete,
    mappingRails: buildMappingRailsState({
      previous: metadata.mappingRails ?? null,
      autoConfigured: true,
      repairs: [],
      issues: complete ? [] : ['Required mappings could not be resolved automatically'],
    }),
  };
}

async function resolveAvailableOpportunityFields(
  db: Database,
  tenantId: string,
): Promise<Set<string>> {
  const credentials = await getSalesforceCredentials(db, tenantId);
  if (!credentials || isMockAccessToken(credentials.accessToken)) {
    return KNOWN_OPPORTUNITY_FIELDS;
  }

  const refreshHandler = async (current: SalesforceCredentials) => {
    if (!env.SALESFORCE_CLIENT_ID || !env.SALESFORCE_CLIENT_SECRET) {
      throw new Error('Salesforce OAuth is not configured');
    }
    const refreshed = await refreshAccessToken({
      refreshToken: current.refreshToken,
      clientId: env.SALESFORCE_CLIENT_ID,
      clientSecret: env.SALESFORCE_CLIENT_SECRET,
      environment: current.environment,
    });
    await saveSalesforceCredentials(db, tenantId, refreshed);
    Object.assign(current, refreshed);
  };

  try {
    const client = new SalesforceClient(credentials, refreshHandler);
    return await client.describeOpportunityFields();
  } catch {
    return KNOWN_OPPORTUNITY_FIELDS;
  }
}

export async function runSalesforceMappingHealthCheck(
  db: Database,
  tenantId: string,
): Promise<SalesforceIntegrationMetadata> {
  const integration = await import('./integration-service.js').then((mod) =>
    mod.getSalesforceIntegration(db, tenantId),
  );
  if (!integration) {
    throw new Error('Salesforce is not connected');
  }

  let metadata = ensureSalesforceAutoMappings(readIntegrationMetadata(integration));
  const availableFields = await resolveAvailableOpportunityFields(db, tenantId);

  const healed = healSalesforceFieldMappings(metadata.fieldMappings, availableFields);
  const { complete } = validateFieldMappings(healed.mappings);

  metadata = {
    ...metadata,
    fieldMappings: healed.mappings,
    mappingComplete: complete,
    mappingRails: buildMappingRailsState({
      previous: metadata.mappingRails ?? null,
      autoConfigured: true,
      repairs: healed.repairs,
      issues: healed.issues,
    }),
  };

  await updateSalesforceMetadata(db, tenantId, metadata);

  const mappedFields = collectSalesforceSoqlFields(metadata.fieldMappings);
  for (const field of mappedFields) {
    if (!availableFields.has(field) && !field.includes('.')) {
      metadata.mappingRails = buildMappingRailsState({
        previous: metadata.mappingRails ?? null,
        autoConfigured: true,
        repairs: [],
        issues: [`Mapped field "${field}" is not available in the source schema`],
      });
    }
  }

  if (metadata.mappingRails?.issues.length) {
    await updateSalesforceMetadata(db, tenantId, metadata);
  }

  return metadata;
}
