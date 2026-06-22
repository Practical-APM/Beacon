import { describe, expect, it } from 'vitest';
import {
  DEFAULT_HUBSPOT_FIELD_MAPPINGS,
  validateHubSpotFieldMappings,
} from './hubspot.js';

describe('hubspot field mappings', () => {
  it('validates default mappings as complete', () => {
    const { complete, missing } = validateHubSpotFieldMappings(DEFAULT_HUBSPOT_FIELD_MAPPINGS);
    expect(complete).toBe(true);
    expect(missing).toEqual([]);
  });
});
