import { describe, expect, it } from 'vitest';
import {
  listCoreCrmPreferenceOptions,
  mergeTenantIntegrationSettings,
  validateCoreCrmPreference,
} from './tenant-settings.js';

describe('tenant integration settings', () => {
  it('defaults core CRM to Salesforce', () => {
    expect(mergeTenantIntegrationSettings({}).coreCrmId).toBe('salesforce');
  });

  it('lists core CRM options from the catalog', () => {
    const options = listCoreCrmPreferenceOptions();
    expect(options.some((option) => option.id === 'salesforce' && option.selectable)).toBe(true);
    expect(options.some((option) => option.id === 'hubspot' && option.selectable)).toBe(true);
    expect(options.some((option) => option.id === 'pipedrive' && option.selectable)).toBe(true);
  });

  it('accepts beta core CRM preferences', () => {
    const result = validateCoreCrmPreference('hubspot');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.coreCrmId).toBe('hubspot');
  });

  it('accepts beta Dynamics core CRM preferences', () => {
    const result = validateCoreCrmPreference('microsoft_dynamics');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.coreCrmId).toBe('microsoft_dynamics');
  });

  it('accepts Pipedrive core CRM preferences', () => {
    const result = validateCoreCrmPreference('pipedrive');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.coreCrmId).toBe('pipedrive');
  });

  it('rejects coming-soon CRM preferences', () => {
    const result = validateCoreCrmPreference('asana');
    expect(result.ok).toBe(false);
  });

  it('accepts available core CRM preferences', () => {
    const result = validateCoreCrmPreference('salesforce');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.coreCrmId).toBe('salesforce');
  });
});
