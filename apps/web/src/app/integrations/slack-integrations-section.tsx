'use client';

import { DomainCollisionBanner } from '@/components/integrations/domain-collision-banner';
import { confirmIntegrationDisconnect } from '@/lib/integration-dialogs';
import { IntegrationConnectPanel } from '@/components/integrations/integration-connect-panel';
import { SlackBotAccessPanel } from '@/components/integrations/slack-bot-access-panel';
import { IntegrationAutoMappingNotice } from '@/components/integrations/integration-auto-mapping-notice';
import { IntegrationCollapsibleSection } from '@/components/integrations/integration-collapsible-section';
import {
  integrationStatusClass,
  integrationStatusLabel,
} from '@/lib/integration-status-styles';
import { useCallback, useEffect, useState } from 'react';

type SlackStatus = {
  connected: boolean;
  status: 'connected' | 'degraded' | 'disconnected' | 'syncing';
  lastSyncAt?: string | null;
  lastError?: string | null;
  metadata?: {
    teamName?: string;
    channelsMissingBot?: string[];
    internalDomains?: string[];
    customerDomains?: string[];
  } | null;
  domainCollisionWarning?: { overlappingDomains: string[]; message: string } | null;
  mappings?: Array<{ id: string; internalId: string; externalId: string; metadata?: Record<string, unknown> }>;
  signals?: Array<{
    channelId: string;
    channelName: string | null;
    botPresent: boolean;
    botAccessError?: string | null;
    lastCustomerMessageAt?: string | null;
    lastInternalResponseAt?: string | null;
  }>;
  syncProgress?: {
    status: string;
    recordsProcessed?: number;
    recordsTotal?: number | null;
  } | null;
};

type SlackChannelSuggestion = {
  channelId: string;
  channelName: string;
  suggestedProjectId: string | null;
  suggestedProjectName: string | null;
  confidence: number;
  botPresent: boolean;
  botAccessError?: string | null;
};

export function SlackIntegrationsSection({
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
  const [status, setStatus] = useState<SlackStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [suggestions, setSuggestions] = useState<SlackChannelSuggestion[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [domainOverrideInput, setDomainOverrideInput] = useState('');
  const [applyingSuggestions, setApplyingSuggestions] = useState(false);
  const [autoMapAttempted, setAutoMapAttempted] = useState(false);

  const mappableSuggestions = suggestions.filter(
    (item) => item.suggestedProjectId && item.botPresent,
  );

  const refreshStatus = useCallback(async () => {
    setLoading(true);
    try {
      const data = (await apiFetch('/v1/integrations/slack/status')) as SlackStatus;
      setStatus(data);
      if (data.connected) {
        const channelData = (await apiFetch('/v1/integrations/slack/channels')) as {
          suggestions: SlackChannelSuggestion[];
        };
        setSuggestions(channelData.suggestions ?? []);
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to load Slack status');
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
        await apiFetch('/v1/integrations/slack/auto-map', { method: 'POST', body: JSON.stringify({}) });
        await refreshStatus();
      } catch {
        // Optional — projects may not exist until CRM import completes.
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
      await apiFetch('/v1/integrations/slack/channel-mappings', {
        method: 'POST',
        body: JSON.stringify({
          beaconProjectId: suggestion.suggestedProjectId,
          channelId: suggestion.channelId,
          channelName: suggestion.channelName,
          domainOverrides: domainOverrideInput
            ? domainOverrideInput.split(/[,\s]+/).map((item) => item.trim().toLowerCase()).filter(Boolean)
            : undefined,
        }),
      });
      }
      onMessage(
        `Mapped ${mappableSuggestions.length} Slack channel${mappableSuggestions.length === 1 ? '' : 's'} using name matches.`,
      );
      await refreshStatus();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Auto-mapping failed');
    } finally {
      setApplyingSuggestions(false);
    }
  }

  async function saveMapping() {
    if (!selectedChannelId) return;
    onMessage(null);
    onError(null);
    const suggestion = suggestions.find((item) => item.channelId === selectedChannelId);
    if (suggestion && !suggestion.botPresent) {
      onError('Invite the Beacon bot to this channel before mapping.');
      return;
    }
    const beaconProjectId = selectedProjectId || suggestion?.suggestedProjectId;
    if (!beaconProjectId) {
      onError('Select a Beacon project to map.');
      return;
    }
    try {
      await apiFetch('/v1/integrations/slack/channel-mappings', {
        method: 'POST',
        body: JSON.stringify({
          beaconProjectId,
          channelId: selectedChannelId,
          channelName: suggestion?.channelName,
          domainOverrides: domainOverrideInput
            ? domainOverrideInput.split(/[,\s]+/).map((item) => item.trim().toLowerCase()).filter(Boolean)
            : undefined,
        }),
      });
      onMessage('Slack channel mapped.');
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
      await apiFetch('/v1/integrations/slack/sync', {
        method: 'POST',
        body: JSON.stringify({ jobType: 'bulk', async: true }),
      });
      onMessage('Slack sync started.');
      await refreshStatus();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }

  async function disconnect() {
    if (!confirmIntegrationDisconnect('Slack')) return;
    onMessage(null);
    onError(null);
    try {
      await apiFetch('/v1/integrations/slack/disconnect', { method: 'DELETE' });
      onMessage('Slack disconnected.');
      await refreshStatus();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Disconnect failed');
    }
  }

  const channelsMissingBot = status?.metadata?.channelsMissingBot ?? [];
  const inaccessibleSignals =
    status?.signals?.filter((signal) => !signal.botPresent || signal.botAccessError) ?? [];

  return (
    <IntegrationCollapsibleSection
      id="slack"
      title="Slack"
      description="Engagement and escalation signals from customer channels — links are applied automatically by project name."
      defaultOpen={Boolean(status?.connected)}
      highlight={inaccessibleSignals.length > 0}
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
          <dt className="text-muted-foreground">Workspace</dt>
          <dd>{status?.metadata?.teamName ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Mapped channels</dt>
          <dd>{status?.mappings?.length ?? 0}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Channels missing bot</dt>
          <dd>{channelsMissingBot.length}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Last sync</dt>
          <dd>{status?.lastSyncAt ? new Date(status.lastSyncAt).toLocaleString() : 'Never'}</dd>
        </div>
      </dl>

      <SlackBotAccessPanel
        connected={Boolean(status?.connected)}
        inaccessibleSignals={inaccessibleSignals}
        suggestions={suggestions}
      />

      {status?.domainCollisionWarning ? (
        <div className="mt-4">
          <DomainCollisionBanner message={status.domainCollisionWarning.message} />
        </div>
      ) : null}

      {status?.lastError ? <p className="mt-4 text-sm text-destructive">{status.lastError}</p> : null}

      {isAdmin && status?.connected ? (
        <div className="mt-6 space-y-4">
          <IntegrationAutoMappingNotice
            toolName="Slack"
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
              {status.status === 'syncing' ? 'Syncing…' : 'Run channel sync'}
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
                  <span className="form-label">Slack channel</span>
                  <select
                    className="form-input"
                    value={selectedChannelId}
                    onChange={(event) => setSelectedChannelId(event.target.value)}
                  >
                    <option value="">Select Slack channel</option>
                    {suggestions.map((item) => (
                      <option key={item.channelId} value={item.channelId}>
                        #{item.channelName}
                        {!item.botPresent ? ' (bot missing)' : ''}
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
                      suggestions.find((item) => item.channelId === selectedChannelId)
                        ?.suggestedProjectId ?? 'Use suggested project ID'
                    }
                  />
                </label>
              </div>
              <label className="flex flex-col gap-2 text-sm">
                <span className="form-label">Customer domain overrides (optional)</span>
                <input
                  className="form-input"
                  value={domainOverrideInput}
                  onChange={(event) => setDomainOverrideInput(event.target.value)}
                  placeholder="e.g. acme.com when it matches your internal domain"
                />
                <span className="text-xs text-muted-foreground">
                  Comma-separated domains to treat as customer email domains for this mapping.
                </span>
              </label>
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
            connectPath="slack"
            connectSource="slack"
            integrationName="Slack"
            onMessage={onMessage}
            onError={onError}
            onConnected={refreshStatus}
            mockHelpText="Uses seeded channels locally. Configure OAuth for real Slack access."
          />
          {!isAdmin ? (
            <p className="mt-6 text-sm text-muted-foreground">
              Slack status is read-only for your role. Ask an admin to connect and sync.
            </p>
          ) : null}
        </>
      )}
    </IntegrationCollapsibleSection>
  );
}
