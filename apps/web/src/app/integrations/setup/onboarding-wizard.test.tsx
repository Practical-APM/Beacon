import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OnboardingWizard } from './onboarding-wizard';
import { fetchCoreCrmPreference, fetchSetupState } from '@/lib/setup-orchestrator';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => '/integrations/setup',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/components/contextual-docs-link', () => ({
  ContextualDocsLink: () => null,
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/lib/use-api-client', () => ({
  useApiClient: () => ({
    apiFetch: vi.fn(),
  }),
}));

vi.mock('@/components/providers/app-session-provider', () => ({
  useAppSession: () => ({
    me: { user: { id: 'user-1' } },
    activeTenantId: 'tenant-1',
    authDevMode: true,
  }),
  useActiveMembership: () => ({ role: 'admin' }),
}));

vi.mock('@/lib/setup-orchestrator', async () => {
  const actual = await vi.importActual<typeof import('@/lib/setup-orchestrator')>(
    '@/lib/setup-orchestrator',
  );
  return {
    ...actual,
    fetchSetupState: vi.fn(),
    fetchCoreCrmPreference: vi.fn(),
  };
});

describe('OnboardingWizard', () => {
  beforeEach(() => {
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
      coreCrmOptions: [
        {
          id: 'salesforce',
          name: 'Salesforce',
          description: 'Import opportunities',
          availability: 'available',
        },
      ],
    });
    vi.mocked(fetchCoreCrmPreference).mockResolvedValue({
      coreCrmId: 'salesforce',
      coreCrmName: 'Salesforce',
      options: [],
      locked: false,
      lockedReason: null,
      connectedCoreCrmId: null,
    });
  });

  it('renders onboarding phases and demo mode banner', async () => {
    render(<OnboardingWizard />);

    await waitFor(() => {
      expect(screen.getByText('Connect your CRM')).toBeInTheDocument();
    });

    expect(screen.getByText('Import projects')).toBeInTheDocument();
    expect(screen.getByText('Enhance risk signals')).toBeInTheDocument();
    expect(screen.getByText('Launch risk center')).toBeInTheDocument();
    expect(screen.getByText('Local demo mode')).toBeInTheDocument();
  });
});
