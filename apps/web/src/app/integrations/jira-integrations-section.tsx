'use client';

import { confirmIntegrationDisconnect } from '@/lib/integration-dialogs';
import { IntegrationConnectPanel } from '@/components/integrations/integration-connect-panel';
import { IntegrationAutoMappingNotice } from '@/components/integrations/integration-auto-mapping-notice';
import { IntegrationCollapsibleSection } from '@/components/integrations/integration-collapsible-section';
import {
  integrationStatusClass,
  integrationStatusLabel,
  integrationWarningClass,
  integrationWarningTitleClass,
} from '@/lib/integration-status-styles';
import { useCallback, useEffect, useState } from 'react';

type JiraStatus = {
  connected: boolean;
  status: 'connected' | 'degraded' | 'disconnected' | 'syncing';
  lastSyncAt?: string | null;
  lastError?: string | null;
  metadata?: { siteUrl?: string; orphanProjectIds?: string[] } | null;
  syncProgress?: {
    status: string;
    recordsProcessed?: number;
    recordsTotal?: number | null;
  } | null;
  mappings?: Array<{ internalId: string; externalId: string; metadata?: Record<string, unknown> }>;
  orphans?: Array<{ id: string; key: string; name: string }>;
};

type JiraProjectSuggestion = {
  jiraProjectId: string;
  jiraProjectName: string;
  suggestedProjectId: string | null;
  suggestedProjectName: string | null;
  confidence: number;
};

export function JiraIntegrationsSection({
  apiFetch,
  isAdmin,
  onMessage,
  onError,
}: {
  apiFetch: (path: string, init?: RequestInit) => Promise<unknown>;
  isAdmin: boolean;
  onMessage: (message: string | null) => void;
  onError: (error: string | null) => void;
}) {
  const [status, setStatus] = useState<JiraStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [suggestions, setSuggestions] = useState<JiraProjectSuggestion[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedJiraProjectId, setSelectedJiraProjectId] = useState('');
  const [applyingSuggestions, setApplyingSuggestions] = useState(false);
  const [autoMapAttempted, setAutoMapAttempted] = useState(false);

  const mappableSuggestions = suggestions.filter((item) => item.suggestedProjectId);

  const refreshStatus = useCallback(async () => {
    setLoading(true);
    try {
      const data = (await apiFetch('/v1/integrations/jira/status')) as JiraStatus;
      setStatus(data);
      if (data.connected) {
        const projectsData = (await apiFetch('/v1/integrations/jira/projects')) as {
          suggestions: JiraProjectSuggestion[];
        };
        setSuggestions(projectsData.suggestions ?? []);
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to load Jira status');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, onError]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    if (!status || status.status !== 'syncing') return;
    const interval = setInterval(() => {
      void refreshStatus();
    }, 2000);
    return () => clearInterval(interval);
  }, [refreshStatus, status]);

  useEffect(() => {
    if (!status?.connected || autoMapAttempted || mappableSuggestions.length === 0) return;
    setAutoMapAttempted(true);
    void (async () => {
      try {
        await apiFetch('/v1/integrations/jira/auto-map', { method: 'POST', body: JSON.stringify({}) });
        await refreshStatus();
      } catch {
        // Optional enhancement — ignore if projects are not ready yet.
      }
    })();
  }, [apiFetch, autoMapAttempted, mappableSuggestions.length, refreshStatus, status?.connected]);

  async function applySuggestedMappings() {
    if (mappableSuggestions.length === 0) return;
    onMessage(null);
    onError(null);
    setApplyingSuggestions(true);
    try {
      for (const suggestion of mappableSuggestions) {
        await apiFetch('/v1/integrations/jira/project-mappings', {
          method: 'POST',
          body: JSON.stringify({
            beaconProjectId: suggestion.suggestedProjectId,
            jiraProjectId: suggestion.jiraProjectId,
            jiraProjectKey: suggestion.jiraProjectName,
            jiraProjectName: suggestion.jiraProjectName,
          }),
        });
      }
      onMessage(
        `Mapped ${mappableSuggestions.length} Jira project${mappableSuggestions.length === 1 ? '' : 's'} using name matches.`,
      );
      await refreshStatus();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Auto-mapping failed');
    } finally {
      setApplyingSuggestions(false);
    }
  }

  async function saveMapping() {
    if (!selectedJiraProjectId) return;
    onMessage(null);
    onError(null);
    const suggestion = suggestions.find((item) => item.jiraProjectId === selectedJiraProjectId);
    const beaconProjectId = selectedProjectId || suggestion?.suggestedProjectId;
    if (!beaconProjectId) {
      onError('Select a Beacon project to map.');
      return;
    }
    try {
      await apiFetch('/v1/integrations/jira/project-mappings', {
        method: 'POST',
        body: JSON.stringify({
          beaconProjectId,
          jiraProjectId: selectedJiraProjectId,
          jiraProjectKey: suggestion?.jiraProjectName,
          jiraProjectName: suggestion?.jiraProjectName,
        }),
      });
      onMessage('Jira project mapped.');
      await refreshStatus();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Mapping failed');
    }
  }

  async function startSync() {
    onMessage(null);
    onError(null);
    setSyncing(true);
    try {
      await apiFetch('/v1/integrations/jira/sync', {
        method: 'POST',
        body: JSON.stringify({ jobType: 'bulk', async: true }),
      });
      onMessage('Jira sync started.');
      await refreshStatus();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }

  async function disconnect() {
    if (!confirmIntegrationDisconnect('Jira')) return;
    onMessage(null);
    onError(null);
    try {
      await apiFetch('/v1/integrations/jira/disconnect', { method: 'DELETE' });
      onMessage('Jira disconnected.');
      await refreshStatus();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Disconnect failed');
    }
  }

  const progress = status?.syncProgress;
  const progressTotal = progress?.recordsTotal ?? null;
  const progressProcessed = progress?.recordsProcessed ?? 0;
  const progressPercent =
    progressTotal && progressTotal > 0
      ? Math.min(100, Math.round((progressProcessed / progressTotal) * 100))
      : status?.status === 'syncing'
        ? 20
        : 0;

  return (
    <IntegrationCollapsibleSection
      id="jira"
      title="Jira"
      description="Delivery signals from epics, stories, and blocked dependencies — project links are applied automatically."
      defaultOpen={Boolean(status?.connected)}
      highlight={Boolean(status?.connected && (status.orphans?.length ?? 0) > 0)}
      statusBadge={
        <span
          className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${integrationStatusClass(loading ? 'loading' : status?.status)}`}
        >
          {loading ? 'Loading…' : integrationStatusLabel(status?.status)}
        </span>
      }
    >
      <dl className="grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Site</dt>
          <dd>{status?.metadata?.siteUrl || '—'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Mapped projects</dt>
          <dd>{status?.mappings?.length ?? 0}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Orphan Jira projects</dt>
          <dd>{status?.orphans?.length ?? 0}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Last sync</dt>
          <dd>{status?.lastSyncAt ? new Date(status.lastSyncAt).toLocaleString() : 'Never'}</dd>
        </div>
      </dl>

      {(status?.orphans?.length ?? 0) > 0 ? (
        <div className={`mt-4 ${integrationWarningClass()}`}>
          <p className={integrationWarningTitleClass()}>Unmapped Jira projects</p>
          <ul className="mt-2 space-y-1 text-muted-foreground">
            {status?.orphans?.map((project) => (
              <li key={project.id}>
                {project.key} — {project.name}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {(status?.status === 'syncing' || progress?.status === 'running') && (
        <div className="mt-6 space-y-2">
          <div className="flex justify-between text-sm">
            <span>Sync progress</span>
            <span>
              {progressProcessed}
              {progressTotal ? ` / ${progressTotal}` : ''} records
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {status?.lastError ? <p className="mt-4 text-sm text-destructive">{status.lastError}</p> : null}

      {isAdmin && status?.connected ? (
        <div className="mt-6 space-y-4">
          <IntegrationAutoMappingNotice
            toolName="Jira"
            mappedCount={status.mappings?.length ?? 0}
            pendingCount={mappableSuggestions.length}
          />

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void startSync()}
              disabled={syncing || status.status === 'syncing'}
              className="btn-primary"
            >
              {status.status === 'syncing' ? 'Syncing…' : 'Run bulk sync'}
            </button>
            <button type="button" onClick={() => void disconnect()} className="btn-secondary">
              Disconnect
            </button>
          </div>

          <details className="rounded-xl border border-border p-4">
            <summary className="cursor-pointer text-sm font-medium text-foreground">
              Advanced manual overrides
            </summary>
            <div className="mt-4 space-y-4">
              {mappableSuggestions.length > 0 ? (
                <button
                  type="button"
                  disabled={applyingSuggestions}
                  onClick={() => void applySuggestedMappings()}
                  className="btn-secondary"
                >
                  {applyingSuggestions ? 'Mapping…' : 'Re-apply suggested links'}
                </button>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-2 text-sm">
                  <span className="form-label">Jira project</span>
                  <select
                    className="form-input"
                    value={selectedJiraProjectId}
                    onChange={(event) => setSelectedJiraProjectId(event.target.value)}
                  >
                    <option value="">Select Jira project</option>
                    {suggestions.map((item) => (
                      <option key={item.jiraProjectId} value={item.jiraProjectId}>
                        {item.jiraProjectName}
                        {item.suggestedProjectName ? ` → ${item.suggestedProjectName}` : ''}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-2 text-sm">
                  <span className="form-label">Beacon project ID</span>
                  <input
                    className="form-input"
                    value={selectedProjectId}
                    onChange={(event) => setSelectedProjectId(event.target.value)}
                    placeholder={
                      suggestions.find((item) => item.jiraProjectId === selectedJiraProjectId)
                        ?.suggestedProjectId ?? 'Use suggested project ID'
                    }
                  />
                </label>
              </div>
              <button type="button" onClick={() => void saveMapping()} className="btn-secondary">
                Save manual link
              </button>
            </div>
          </details>
        </div>
      ) : (
        <>
          <IntegrationConnectPanel
            apiFetch={apiFetch}
            isAdmin={isAdmin}
            connected={Boolean(status?.connected)}
            connectPath="jira"
            connectSource="jira"
            integrationName="Jira"
            onMessage={onMessage}
            onError={onError}
            onConnected={refreshStatus}
            mockHelpText="Uses seeded work items locally. Configure OAuth for real Jira access."
          />
          {!isAdmin ? (
            <p className="mt-6 text-sm text-muted-foreground">
              Jira status is read-only for your role. Ask an admin to connect and sync.
            </p>
          ) : null}
        </>
      )}
    </IntegrationCollapsibleSection>
  );
}
