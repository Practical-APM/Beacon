'use client';

import { confirmIntegrationDisconnect } from '@/lib/integration-dialogs';
import { IntegrationConnectPanel } from '@/components/integrations/integration-connect-panel';
import { IntegrationAutoMappingNotice } from '@/components/integrations/integration-auto-mapping-notice';
import { IntegrationCollapsibleSection } from '@/components/integrations/integration-collapsible-section';
import {
  integrationStatusClass,
  integrationStatusLabel,
} from '@/lib/integration-status-styles';
import { useCallback, useEffect, useState } from 'react';

type LinearStatus = {
  connected: boolean;
  status: 'connected' | 'degraded' | 'disconnected' | 'syncing';
  lastSyncAt?: string | null;
  lastError?: string | null;
  metadata?: { organizationName?: string } | null;
  syncProgress?: {
    status: string;
    recordsProcessed?: number;
    recordsTotal?: number | null;
  } | null;
  mappings?: Array<{ internalId: string; externalId: string; metadata?: Record<string, unknown> }>;
};

type LinearTeamSuggestion = {
  linearTeamId: string;
  linearTeamName: string;
  suggestedProjectId: string | null;
  suggestedProjectName: string | null;
  confidence: number;
};

export function LinearIntegrationsSection({
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
  const [status, setStatus] = useState<LinearStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [suggestions, setSuggestions] = useState<LinearTeamSuggestion[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [autoMapAttempted, setAutoMapAttempted] = useState(false);

  const mappableSuggestions = suggestions.filter((item) => item.suggestedProjectId);

  const refreshStatus = useCallback(async () => {
    setLoading(true);
    try {
      const data = (await apiFetch('/v1/integrations/linear/status')) as LinearStatus;
      setStatus(data);
      if (data.connected) {
        const teamsData = (await apiFetch('/v1/integrations/linear/teams')) as {
          suggestions: LinearTeamSuggestion[];
        };
        setSuggestions(teamsData.suggestions ?? []);
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to load Linear status');
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
        await apiFetch('/v1/integrations/linear/auto-map', { method: 'POST', body: JSON.stringify({}) });
        await refreshStatus();
      } catch {
        // Optional enhancement — ignore if teams are not ready yet.
      }
    })();
  }, [apiFetch, autoMapAttempted, mappableSuggestions.length, refreshStatus, status?.connected]);

  async function saveMapping() {
    if (!selectedTeamId) return;
    onMessage(null);
    onError(null);
    const suggestion = suggestions.find((item) => item.linearTeamId === selectedTeamId);
    const beaconProjectId = selectedProjectId || suggestion?.suggestedProjectId;
    if (!beaconProjectId) {
      onError('Select a Beacon project to map.');
      return;
    }
    try {
      await apiFetch('/v1/integrations/linear/team-mappings', {
        method: 'POST',
        body: JSON.stringify({
          beaconProjectId,
          linearTeamId: selectedTeamId,
          linearTeamKey: suggestion?.linearTeamName,
          linearTeamName: suggestion?.linearTeamName,
        }),
      });
      onMessage('Linear team mapped.');
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
      await apiFetch('/v1/integrations/linear/sync', {
        method: 'POST',
        body: JSON.stringify({ jobType: 'bulk', async: true }),
      });
      onMessage('Linear sync started.');
      await refreshStatus();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }

  async function disconnect() {
    if (!confirmIntegrationDisconnect('Linear')) return;
    onMessage(null);
    onError(null);
    try {
      await apiFetch('/v1/integrations/linear/disconnect', { method: 'DELETE' });
      onMessage('Linear disconnected.');
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
      id="linear"
      title="Linear"
      description="Delivery signals from issues and workflow states — team links are applied automatically."
      defaultOpen={Boolean(status?.connected)}
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
          <dt className="text-muted-foreground">Organization</dt>
          <dd>{status?.metadata?.organizationName || '—'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Mapped teams</dt>
          <dd>{status?.mappings?.length ?? 0}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Last sync</dt>
          <dd>{status?.lastSyncAt ? new Date(status.lastSyncAt).toLocaleString() : 'Never'}</dd>
        </div>
      </dl>

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
            toolName="Linear"
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
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm">
                <span className="form-label">Linear team</span>
                <select
                  className="form-input"
                  value={selectedTeamId}
                  onChange={(event) => setSelectedTeamId(event.target.value)}
                >
                  <option value="">Select Linear team</option>
                  {suggestions.map((item) => (
                    <option key={item.linearTeamId} value={item.linearTeamId}>
                      {item.linearTeamName}
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
                    suggestions.find((item) => item.linearTeamId === selectedTeamId)
                      ?.suggestedProjectId ?? 'Use suggested project ID'
                  }
                />
              </label>
            </div>
            <button type="button" onClick={() => void saveMapping()} className="btn-secondary mt-4">
              Save manual link
            </button>
          </details>
        </div>
      ) : (
        <>
          <IntegrationConnectPanel
            apiFetch={apiFetch}
            isAdmin={isAdmin}
            connected={Boolean(status?.connected)}
            connectPath="linear"
            connectSource="linear"
            integrationName="Linear"
            onMessage={onMessage}
            onError={onError}
            onConnected={refreshStatus}
            mockHelpText="Uses seeded issues locally. Configure OAuth for real Linear access."
          />
          {!isAdmin ? (
            <p className="mt-6 text-sm text-muted-foreground">
              Linear status is read-only for your role. Ask an admin to connect and sync.
            </p>
          ) : null}
        </>
      )}
    </IntegrationCollapsibleSection>
  );
}
