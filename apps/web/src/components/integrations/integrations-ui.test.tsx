import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { evaluateSetupReadiness } from '@/lib/setup-readiness';
import { DevMockIntegrationsBanner } from './dev-mock-integrations-banner';
import { SetupReadinessChecklist } from './setup-readiness-checklist';

describe('integrations UI', () => {
  it('explains local demo mode on integrations pages', () => {
    render(<DevMockIntegrationsBanner />);
    expect(screen.getByText('Local demo mode')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Setup walkthrough' })).toHaveAttribute(
      'href',
      '/docs?guide=connect-stack&step=0',
    );
  });

  it('lists setup blockers on the integrations checklist', () => {
    const readiness = evaluateSetupReadiness({
      coreCrm: {
        connected: false,
        status: 'disconnected',
        mappingComplete: false,
        lastSyncAt: null,
      },
      workItems: { connected: false, status: 'disconnected' },
      engagement: { connected: false, status: 'disconnected' },
    });

    render(<SetupReadinessChecklist readiness={readiness} />);

    expect(screen.getByText('Setup progress')).toBeInTheDocument();
    expect(screen.getAllByText('Connect Salesforce').length).toBeGreaterThan(0);
  });
});
