import { buildMappingRailsState, healDynamicsFieldMappings } from '@beacon/shared/integrations';
import {
  DEFAULT_DYNAMICS_FIELD_MAPPINGS,
  validateDynamicsFieldMappings,
  type DynamicsIntegrationMetadata,
} from '@beacon/shared';
import type { Database } from '@beacon/db';
import { env } from '../../env.js';
import { isMockAccessToken } from '../../lib/mock-integration.js';
import { DynamicsClient } from './client.js';
import {
  getDynamicsCredentials,
  readIntegrationMetadata,
  saveDynamicsCredentials,
  updateDynamicsMetadata,
} from './integration-service.js';
import { buildDefaultMetadata, refreshAccessToken } from './oauth.js';
import type { DynamicsCredentials } from './types.js';

const KNOWN_DYNAMICS_RECORD_FIELDS = new Set([
  'name',
  'accountId',
  'accountName',
  'ownerName',
  'ownerEmail',
  'stageName',
  'amount',
  'closedate',
  'modifiedon',
  'estimatedvalue',
  'estimatedclosedate',
  'statuscodename',
  'opportunityid',
]);

export function ensureDynamicsAutoMappings(
  metadata: DynamicsIntegrationMetadata,
): DynamicsIntegrationMetadata {
  const fieldMappings = {
    ...DEFAULT_DYNAMICS_FIELD_MAPPINGS,
    ...metadata.fieldMappings,
  };
  const { complete } = validateDynamicsFieldMappings(fieldMappings);

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
  const credentials = await getDynamicsCredentials(db, tenantId);
  if (!credentials || isMockAccessToken(credentials.accessToken)) {
    return KNOWN_DYNAMICS_RECORD_FIELDS;
  }

  const refreshHandler = async (current: DynamicsCredentials) => {
    if (!env.DYNAMICS_CLIENT_ID || !env.DYNAMICS_CLIENT_SECRET) {
      throw new Error('Dynamics OAuth is not configured');
    }
    const refreshed = await refreshAccessToken({
      refreshToken: current.refreshToken,
      clientId: env.DYNAMICS_CLIENT_ID,
      clientSecret: env.DYNAMICS_CLIENT_SECRET,
      azureTenantId: current.azureTenantId,
      orgUrl: current.orgUrl,
      orgId: current.orgId,
    });
    await saveDynamicsCredentials(db, tenantId, refreshed);
    Object.assign(current, refreshed);
  };

  try {
    const client = new DynamicsClient(credentials, refreshHandler);
    const described = await client.describeOpportunityAttributes();
    return new Set([...KNOWN_DYNAMICS_RECORD_FIELDS, ...described]);
  } catch {
    return KNOWN_DYNAMICS_RECORD_FIELDS;
  }
}

export async function runDynamicsMappingHealthCheck(
  db: Database,
  tenantId: string,
): Promise<DynamicsIntegrationMetadata> {
  const integration = await import('./integration-service.js').then((mod) =>
    mod.getDynamicsIntegration(db, tenantId),
  );
  if (!integration) {
    throw new Error('Dynamics 365 is not connected');
  }

  let metadata = ensureDynamicsAutoMappings(readIntegrationMetadata(integration));
  const availableFields = await resolveAvailableOpportunityFields(db, tenantId);
  const healed = healDynamicsFieldMappings(metadata.fieldMappings, availableFields);
  const { complete } = validateDynamicsFieldMappings(healed.mappings);

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

  await updateDynamicsMetadata(db, tenantId, metadata);
  return metadata;
}

export function resetDynamicsMetadata(orgUrl: string, orgId: string): DynamicsIntegrationMetadata {
  return ensureDynamicsAutoMappings(buildDefaultMetadata(orgUrl, orgId));
}
