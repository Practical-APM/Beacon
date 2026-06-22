import { describe, expect, it } from 'vitest';
import {
  buildIntegrationAuthAlertContent,
  integrationDisplayName,
  isAuthRelatedIntegrationError,
} from './auth-errors.js';

describe('isAuthRelatedIntegrationError', () => {
  it('detects token refresh failures', () => {
    expect(isAuthRelatedIntegrationError('Salesforce token refresh failed: invalid_grant')).toBe(true);
  });

  it('detects oauth errors', () => {
    expect(isAuthRelatedIntegrationError('oauth_failed')).toBe(true);
  });

  it('ignores generic sync failures', () => {
    expect(isAuthRelatedIntegrationError('Salesforce sync failed: timeout')).toBe(false);
  });
});

describe('buildIntegrationAuthAlertContent', () => {
  it('builds admin-facing alert copy', () => {
    const content = buildIntegrationAuthAlertContent({
      source: 'salesforce',
      errorMessage: 'Salesforce token refresh failed: invalid_grant',
      integrationsUrl: 'https://app.example.com/integrations',
    });

    expect(content.title).toContain('Salesforce');
    expect(content.body).toContain('invalid_grant');
    expect(content.text).toContain('https://app.example.com/integrations');
    expect(integrationDisplayName('google_calendar')).toBe('Google Calendar');
  });
});
