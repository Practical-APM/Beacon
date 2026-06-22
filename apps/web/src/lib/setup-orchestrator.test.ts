import { describe, expect, it, vi } from 'vitest';
import {
  advanceSetup,
  bootstrapAfterConnect,
  fetchCoreCrmPreference,
  fetchCoreCrmReadiness,
  fetchSetupState,
  setCoreCrmPreference,
} from './setup-orchestrator';

describe('setup orchestrator client', () => {
  it('fetchSetupState calls setup state endpoint', async () => {
    const apiFetch = vi.fn().mockResolvedValue({ phase: 'ready' });
    await fetchSetupState(apiFetch);
    expect(apiFetch).toHaveBeenCalledWith('/v1/integrations/setup/state');
  });

  it('fetchCoreCrmPreference calls preference endpoint', async () => {
    const apiFetch = vi.fn().mockResolvedValue({ coreCrmId: 'salesforce' });
    await fetchCoreCrmPreference(apiFetch);
    expect(apiFetch).toHaveBeenCalledWith('/v1/integrations/core-crm/preference');
  });

  it('setCoreCrmPreference patches selected CRM', async () => {
    const apiFetch = vi.fn().mockResolvedValue({ coreCrmId: 'hubspot' });
    await setCoreCrmPreference(apiFetch, 'hubspot');
    expect(apiFetch).toHaveBeenCalledWith('/v1/integrations/core-crm/preference', {
      method: 'PATCH',
      body: JSON.stringify({ coreCrmId: 'hubspot' }),
    });
  });

  it('fetchCoreCrmReadiness calls readiness endpoint', async () => {
    const apiFetch = vi.fn().mockResolvedValue({ coreCrmId: 'salesforce' });
    await fetchCoreCrmReadiness(apiFetch);
    expect(apiFetch).toHaveBeenCalledWith('/v1/integrations/core-crm/readiness');
  });

  it('advanceSetup posts to setup advance endpoint', async () => {
    const apiFetch = vi.fn().mockResolvedValue({ phase: 'importing', actionsTaken: [] });
    await advanceSetup(apiFetch);
    expect(apiFetch).toHaveBeenCalledWith('/v1/integrations/setup/advance', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  });

  it('bootstrapAfterConnect delegates to advanceSetup', async () => {
    const apiFetch = vi.fn().mockResolvedValue({ phase: 'enhance_signals', actionsTaken: [] });
    await bootstrapAfterConnect(apiFetch);
    expect(apiFetch).toHaveBeenCalledWith('/v1/integrations/setup/advance', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  });
});
