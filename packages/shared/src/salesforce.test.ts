import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SALESFORCE_FIELD_MAPPINGS,
  getSalesforceLoginHost,
  validateFieldMappings,
} from './salesforce.js';

describe('salesforce shared helpers', () => {
  it('returns correct login hosts', () => {
    expect(getSalesforceLoginHost('production')).toBe('https://login.salesforce.com');
    expect(getSalesforceLoginHost('sandbox')).toBe('https://test.salesforce.com');
  });

  it('validates required field mappings', () => {
    const complete = validateFieldMappings(DEFAULT_SALESFORCE_FIELD_MAPPINGS);
    expect(complete.complete).toBe(true);
    expect(complete.missing).toEqual([]);
  });

  it('reports missing mappings', () => {
    const result = validateFieldMappings({ opportunityName: 'Name' });
    expect(result.complete).toBe(false);
    expect(result.missing).toContain('accountExternalId');
  });
});
