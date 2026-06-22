import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SetupFlowGuard } from './setup-flow-guard';
import { fetchSetupState } from '@/lib/setup-orchestrator';

const replace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/dashboard',
}));

vi.mock('@/lib/use-api-client', () => ({
  useApiClient: () => ({
    apiFetch: vi.fn(),
    ready: true,
  }),
}));

vi.mock('@/components/providers/app-session-provider', () => ({
  useAppSession: () => ({ activeTenantId: 'tenant-1' }),
  useActiveMembership: () => ({ role: 'admin' }),
}));

vi.mock('@/lib/setup-orchestrator', () => ({
  fetchSetupState: vi.fn(),
}));

describe('SetupFlowGuard', () => {
  beforeEach(() => {
    replace.mockReset();
    vi.mocked(fetchSetupState).mockReset();
  });

  it('redirects admins to setup when workspace is not ready', async () => {
    vi.mocked(fetchSetupState).mockResolvedValue({
      phase: 'connect_core_crm',
      coreCrmId: 'salesforce',
      coreCrmName: 'Salesforce',
      coreCrmConnected: false,
      coreCrmSynced: false,
      syncInProgress: false,
      optionalConnected: 0,
      optionalTotal: 2,
      message: 'Connect CRM',
      coreCrmOptions: [],
    });

    render(
      <SetupFlowGuard>
        <p>Dashboard content</p>
      </SetupFlowGuard>,
    );

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/integrations/setup');
    });
  });

  it('surfaces setup fetch errors instead of failing silently', async () => {
    vi.mocked(fetchSetupState).mockRejectedValue(new Error('API unavailable'));

    render(
      <SetupFlowGuard>
        <p>Dashboard content</p>
      </SetupFlowGuard>,
    );

    expect(await screen.findByText('API unavailable')).toBeInTheDocument();
    expect(screen.getByText('Dashboard content')).toBeInTheDocument();
  });
});
