import { buildMappingRailsState, healHubSpotFieldMappings } from '@beacon/shared/integrations';
import {
  DEFAULT_HUBSPOT_FIELD_MAPPINGS,
  validateHubSpotFieldMappings,
  type HubSpotIntegrationMetadata,
} from '@beacon/shared';
import type { Database } from '@beacon/db';
import { env } from '../../env.js';
import { isMockAccessToken } from '../../lib/mock-integration.js';
import { HubSpotClient } from './client.js';
import {
  getHubSpotCredentials,
  readIntegrationMetadata,
  saveHubSpotCredentials,
  updateHubSpotMetadata,
} from './integration-service.js';
import { buildDefaultMetadata, refreshAccessToken } from './oauth.js';
import type { HubSpotCredentials } from './types.js';

const KNOWN_HUBSPOT_RECORD_FIELDS = new Set([
  'dealname',
  'companyId',
  'companyName',
  'ownerName',
  'ownerEmail',
  'dealstage',
  'amount',
  'closedate',
  'hs_lastmodifieddate',
  'hubspot_owner_id',
]);

export function ensureHubSpotAutoMappings(
  metadata: HubSpotIntegrationMetadata,
): HubSpotIntegrationMetadata {
  const fieldMappings = {
    ...DEFAULT_HUBSPOT_FIELD_MAPPINGS,
    ...metadata.fieldMappings,
  };
  const { complete } = validateHubSpotFieldMappings(fieldMappings);

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

async function resolveAvailableDealFields(
  db: Database,
  tenantId: string,
): Promise<Set<string>> {
  const credentials = await getHubSpotCredentials(db, tenantId);
  if (!credentials || isMockAccessToken(credentials.accessToken)) {
    return KNOWN_HUBSPOT_RECORD_FIELDS;
  }

  const refreshHandler = async (current: HubSpotCredentials) => {
    if (!env.HUBSPOT_CLIENT_ID || !env.HUBSPOT_CLIENT_SECRET) {
      throw new Error('HubSpot OAuth is not configured');
    }
    const refreshed = await refreshAccessToken({
      refreshToken: current.refreshToken,
      clientId: env.HUBSPOT_CLIENT_ID,
      clientSecret: env.HUBSPOT_CLIENT_SECRET,
    });
    await saveHubSpotCredentials(db, tenantId, refreshed);
    Object.assign(current, refreshed);
  };

  try {
    const client = new HubSpotClient(credentials, refreshHandler);
    const described = await client.describeDealProperties();
    return new Set([...KNOWN_HUBSPOT_RECORD_FIELDS, ...described]);
  } catch {
    return KNOWN_HUBSPOT_RECORD_FIELDS;
  }
}

export async function runHubSpotMappingHealthCheck(
  db: Database,
  tenantId: string,
): Promise<HubSpotIntegrationMetadata> {
  const integration = await import('./integration-service.js').then((mod) =>
    mod.getHubSpotIntegration(db, tenantId),
  );
  if (!integration) {
    throw new Error('HubSpot is not connected');
  }

  let metadata = ensureHubSpotAutoMappings(readIntegrationMetadata(integration));
  const availableFields = await resolveAvailableDealFields(db, tenantId);
  const healed = healHubSpotFieldMappings(metadata.fieldMappings, availableFields);
  const { complete } = validateHubSpotFieldMappings(healed.mappings);

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

  await updateHubSpotMetadata(db, tenantId, metadata);
  return metadata;
}

export function resetHubSpotMetadata(portalId: string): HubSpotIntegrationMetadata {
  return ensureHubSpotAutoMappings(buildDefaultMetadata(portalId));
}
