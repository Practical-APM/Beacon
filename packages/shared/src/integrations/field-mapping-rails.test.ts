import { describe, expect, it } from 'vitest';
import { DEFAULT_DYNAMICS_FIELD_MAPPINGS } from '../dynamics.js';
import { DEFAULT_HUBSPOT_FIELD_MAPPINGS } from '../hubspot.js';
import {
  healDynamicsFieldMappings,
  healHubSpotFieldMappings,
} from './field-mapping-rails.js';

describe('hubspot mapping rails', () => {
  it('repairs missing deal property aliases', () => {
    const available = new Set([
      'dealname',
      'amount',
      'closedate',
      'dealstage',
      'hs_lastmodifieddate',
      'ownerName',
      'ownerEmail',
      'hubspot_owner_id',
    ]);
    const healed = healHubSpotFieldMappings(
      {
        ...DEFAULT_HUBSPOT_FIELD_MAPPINGS,
        dealName: 'missing_deal_name',
        arrAmount: 'missing_amount',
      },
      available,
    );

    expect(healed.mappings.dealName).toBe('dealname');
    expect(healed.mappings.arrAmount).toBe('amount');
    expect(healed.repairs).toHaveLength(2);
    expect(healed.issues).toEqual([]);
  });
});

describe('dynamics mapping rails', () => {
  it('repairs missing opportunity attribute aliases', () => {
    const available = new Set(['name', 'amount', 'closedate', 'stageName', 'modifiedon', 'ownerName', 'ownerEmail']);
    const healed = healDynamicsFieldMappings(
      {
        ...DEFAULT_DYNAMICS_FIELD_MAPPINGS,
        opportunityName: 'missing_name',
        arrAmount: 'missing_amount',
      },
      available,
    );

    expect(healed.mappings.opportunityName).toBe('name');
    expect(healed.mappings.arrAmount).toBe('amount');
    expect(healed.repairs).toHaveLength(2);
    expect(healed.issues).toEqual([]);
  });
});
