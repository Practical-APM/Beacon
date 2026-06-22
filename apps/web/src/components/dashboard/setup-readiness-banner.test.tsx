import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { evaluateSetupReadiness } from '@/lib/setup-readiness';
import { SetupReadinessBanner } from './setup-readiness-banner';

describe('SetupReadinessBanner', () => {
  it('prompts admin to connect Salesforce when CRM is disconnected', () => {
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

    render(<SetupReadinessBanner readiness={readiness} />);

    expect(screen.getByRole('link', { name: /Connect Salesforce/i })).toHaveAttribute(
      'href',
      '/integrations/setup',
    );
  });

  it('shows sync progress while CRM import is running', () => {
    const readiness = evaluateSetupReadiness({
      coreCrm: {
        connected: true,
        status: 'syncing',
        mappingComplete: true,
        lastSyncAt: null,
        syncProgress: { recordsProcessed: 25, recordsTotal: 100 },
      },
      workItems: { connected: false, status: 'disconnected' },
      engagement: { connected: false, status: 'disconnected' },
    });

    render(<SetupReadinessBanner readiness={readiness} />);

    expect(screen.getByText(/25 \/ 100 records processed/)).toBeInTheDocument();
  });
});
