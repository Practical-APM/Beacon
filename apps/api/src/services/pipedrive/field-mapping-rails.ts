import { buildMappingRailsState, healPipedriveFieldMappings } from '@beacon/shared/integrations';
import {
  DEFAULT_PIPEDRIVE_FIELD_MAPPINGS,
  validatePipedriveFieldMappings,
  type PipedriveIntegrationMetadata,
} from '@beacon/shared';
import type { Database } from '@beacon/db';
import { env } from '../../env.js';
import { isMockAccessToken } from '../../lib/mock-integration.js';
import { PipedriveClient } from './client.js';
import {
  getPipedriveCredentials,
  readIntegrationMetadata,
  savePipedriveCredentials,
  updatePipedriveMetadata,
} from './integration-service.js';
import { buildDefaultMetadata, refreshAccessToken } from './oauth.js';
import type { PipedriveCredentials } from './types.js';

const KNOWN_PIPEDRIVE_RECORD_FIELDS = new Set([
  'title',
  'org_id',
  'org_name',
  'owner_name',
  'owner_email',
  'stage_name',
  'value',
  'expected_close_date',
  'update_time',
]);

export function ensurePipedriveAutoMappings(
  metadata: PipedriveIntegrationMetadata,
): PipedriveIntegrationMetadata {
  const fieldMappings = {
    ...DEFAULT_PIPEDRIVE_FIELD_MAPPINGS,
    ...metadata.fieldMappings,
  };
  const { complete } = validatePipedriveFieldMappings(fieldMappings);

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
  const credentials = await getPipedriveCredentials(db, tenantId);
  if (!credentials || isMockAccessToken(credentials.accessToken)) {
    return KNOWN_PIPEDRIVE_RECORD_FIELDS;
  }

  const refreshHandler = async (current: PipedriveCredentials) => {
    if (!env.PIPEDRIVE_CLIENT_ID || !env.PIPEDRIVE_CLIENT_SECRET) {
      throw new Error('Pipedrive OAuth is not configured');
    }
    const refreshed = await refreshAccessToken({
      refreshToken: current.refreshToken,
      clientId: env.PIPEDRIVE_CLIENT_ID,
      clientSecret: env.PIPEDRIVE_CLIENT_SECRET,
      apiDomain: current.apiDomain,
      companyId: current.companyId,
    });
    await savePipedriveCredentials(db, tenantId, refreshed);
    Object.assign(current, refreshed);
  };

  try {
    const client = new PipedriveClient(credentials, refreshHandler);
    const described = await client.describeDealFields();
    return new Set([...KNOWN_PIPEDRIVE_RECORD_FIELDS, ...described]);
  } catch {
    return KNOWN_PIPEDRIVE_RECORD_FIELDS;
  }
}

export async function runPipedriveMappingHealthCheck(
  db: Database,
  tenantId: string,
): Promise<PipedriveIntegrationMetadata> {
  const integration = await import('./integration-service.js').then((mod) =>
    mod.getPipedriveIntegration(db, tenantId),
  );
  if (!integration) {
    throw new Error('Pipedrive is not connected');
  }

  let metadata = ensurePipedriveAutoMappings(readIntegrationMetadata(integration));
  const availableFields = await resolveAvailableDealFields(db, tenantId);
  const healed = healPipedriveFieldMappings(metadata.fieldMappings, availableFields);
  const { complete } = validatePipedriveFieldMappings(healed.mappings);

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

  await updatePipedriveMetadata(db, tenantId, metadata);
  return metadata;
}

export function resetPipedriveMetadata(companyId: string): PipedriveIntegrationMetadata {
  return ensurePipedriveAutoMappings(buildDefaultMetadata(companyId));
}
