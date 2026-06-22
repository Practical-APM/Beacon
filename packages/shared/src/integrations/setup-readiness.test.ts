import { describe, expect, it } from 'vitest';
import { DEFAULT_CORE_CRM_ID } from './catalog.js';
import { evaluateSetupReadiness } from './setup-readiness.js';

describe('evaluateSetupReadiness', () => {
  it('uses catalog labels for the default core CRM', () => {
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

    expect(readiness.coreCrmId).toBe(DEFAULT_CORE_CRM_ID);
    expect(readiness.coreCrmName).toBe('Salesforce');
    expect(readiness.nextBlocker?.label).toBe('Connect Salesforce');
    expect(readiness.isReadyForCoreIntelligence).toBe(false);
  });

  it('reports sync in progress before first successful sync', () => {
    const readiness = evaluateSetupReadiness({
      coreCrm: {
        connected: true,
        status: 'syncing',
        mappingComplete: true,
        lastSyncAt: null,
        syncProgress: { recordsProcessed: 12, recordsTotal: 100 },
      },
      workItems: { connected: false, status: 'disconnected' },
      engagement: { connected: false, status: 'disconnected' },
    });

    expect(readiness.syncInProgress).toBe(true);
    expect(readiness.nextBlocker?.id).toBe(`${DEFAULT_CORE_CRM_ID}-sync-running`);
    expect(readiness.blockers.some((b) => b.id.includes('mappings'))).toBe(false);
  });

  it('flags unlinked Jira projects when work tracker is connected', () => {
    const readiness = evaluateSetupReadiness({
      coreCrm: {
        connected: true,
        status: 'connected',
        mappingComplete: true,
        lastSyncAt: '2026-06-01T00:00:00.000Z',
      },
      workItems: { connected: true, status: 'connected' },
      engagement: { connected: false, status: 'disconnected' },
      unlinkedJiraProjectCount: 2,
    });

    expect(readiness.blockers.some((blocker) => blocker.id === 'jira-unlinked-projects')).toBe(true);
  });
});
