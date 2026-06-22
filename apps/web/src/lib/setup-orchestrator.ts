import type { ApiFetch } from '@/lib/demo-setup';
import type { CoreCrmPreferenceOption } from '@beacon/shared/integrations';

export type SetupPhase =
  | 'connect_core_crm'
  | 'importing'
  | 'enhance_signals'
  | 'ready';

export type SetupState = {
  phase: SetupPhase;
  coreCrmId: string;
  coreCrmName: string;
  coreCrmConnected: boolean;
  coreCrmSynced: boolean;
  syncInProgress: boolean;
  optionalConnected: number;
  optionalTotal: number;
  message: string;
  coreCrmOptions: CoreCrmPreferenceOption[];
};

export type CoreCrmPreferenceState = {
  coreCrmId: string;
  coreCrmName: string;
  options: CoreCrmPreferenceOption[];
  locked: boolean;
  lockedReason: string | null;
  connectedCoreCrmId: string | null;
};

export type CoreCrmReadinessResponse = {
  coreCrmId: string;
  coreCrmName: string;
  snapshot: {
    connected: boolean;
    status: string;
    mappingComplete: boolean;
    lastSyncAt: string | null;
    syncProgress?: {
      recordsProcessed?: number;
      recordsTotal?: number | null;
    } | null;
  };
};

export type AdvanceSetupResult = SetupState & {
  actionsTaken: string[];
};

export async function fetchSetupState(apiFetch: ApiFetch): Promise<SetupState> {
  return (await apiFetch('/v1/integrations/setup/state')) as SetupState;
}

export async function fetchCoreCrmPreference(apiFetch: ApiFetch): Promise<CoreCrmPreferenceState> {
  return (await apiFetch('/v1/integrations/core-crm/preference')) as CoreCrmPreferenceState;
}

export async function setCoreCrmPreference(
  apiFetch: ApiFetch,
  coreCrmId: string,
): Promise<CoreCrmPreferenceState> {
  return (await apiFetch('/v1/integrations/core-crm/preference', {
    method: 'PATCH',
    body: JSON.stringify({ coreCrmId }),
  })) as CoreCrmPreferenceState;
}

export async function fetchCoreCrmReadiness(apiFetch: ApiFetch): Promise<CoreCrmReadinessResponse> {
  return (await apiFetch('/v1/integrations/core-crm/readiness')) as CoreCrmReadinessResponse;
}

export async function advanceSetup(apiFetch: ApiFetch): Promise<AdvanceSetupResult> {
  return (await apiFetch('/v1/integrations/setup/advance', {
    method: 'POST',
    body: JSON.stringify({}),
  })) as AdvanceSetupResult;
}

export async function bootstrapAfterConnect(apiFetch: ApiFetch): Promise<AdvanceSetupResult> {
  return advanceSetup(apiFetch);
}
