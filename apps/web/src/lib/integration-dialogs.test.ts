import { describe, expect, it, vi } from 'vitest';
import {
  confirmCoreCrmReconnect,
  confirmIntegrationDisconnect,
  coreCrmOrgChangeWarning,
  CORE_CRM_CONNECTED_LABELS,
} from './integration-dialogs';

describe('integration dialog helpers', () => {
  it('confirms integration disconnect', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    expect(confirmIntegrationDisconnect('Salesforce')).toBe(true);
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('Disconnect Salesforce'));
  });

  it('confirms core CRM reconnect with CRM name', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    expect(confirmCoreCrmReconnect('HubSpot')).toBe(false);
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('HubSpot'));
  });

  it('builds org-change warning copy', () => {
    expect(coreCrmOrgChangeWarning('Salesforce')).toContain('Salesforce');
  });

  it('labels connected core CRM integrations', () => {
    expect(CORE_CRM_CONNECTED_LABELS.salesforce).toBe('Salesforce');
    expect(CORE_CRM_CONNECTED_LABELS.hubspot).toBe('HubSpot');
  });
});
