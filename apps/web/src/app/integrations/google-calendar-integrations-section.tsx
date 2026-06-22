'use client';

import { DomainCollisionBanner } from '@/components/integrations/domain-collision-banner';
import { confirmIntegrationDisconnect } from '@/lib/integration-dialogs';
import {
  integrationStatusClass,
  integrationStatusLabel,
} from '@/lib/integration-status-styles';
import { IntegrationConnectPanel } from '@/components/integrations/integration-connect-panel';
import { IntegrationCollapsibleSection } from '@/components/integrations/integration-collapsible-section';
import { useCallback, useEffect, useState } from 'react';

type CalendarStatus = {
  connected: boolean;
  status: 'connected' | 'degraded' | 'disconnected' | 'syncing';
  lastSyncAt?: string | null;
  lastError?: string | null;
  metadata?: { accountEmail?: string; accountName?: string } | null;
  mappings?: Array<{ id: string; internalId: string; externalId: string; metadata?: Record<string, unknown> }>;
  signals?: Array<{
    calendarId: string;
    calendarName: string | null;
    lastCustomerMeetingAt?: string | null;
    meetingCount30d?: number;
  }>;
  syncProgress?: { status: string; recordsProcessed?: number; recordsTotal?: number | null } | null;
  domainCollisionWarning?: { overlappingDomains: string[]; message: string } | null;
};

type CalendarSuggestion = {
  calendarId: string;
  calendarName: string;
  suggestedProjectId: string | null;
  suggestedProjectName: string | null;
  confidence: number;
};

export function GoogleCalendarIntegrationsSection({
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
  const [status, setStatus] = useState<CalendarStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [suggestions, setSuggestions] = useState<CalendarSuggestion[]>([]);
  const [selectedCalendarId, setSelectedCalendarId] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [domainOverrideInput, setDomainOverrideInput] = useState('');

  const refreshStatus = useCallback(async () => {
    setLoading(true);
    try {
      const data = (await apiFetch('/v1/integrations/google-calendar/status')) as CalendarStatus;
      setStatus(data);
      if (data.connected) {
        const calendarData = (await apiFetch('/v1/integrations/google-calendar/calendars')) as {
          suggestions: CalendarSuggestion[];
        };
        setSuggestions(calendarData.suggestions ?? []);
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to load Google Calendar status');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, onError]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    if (!status || status.status !== 'syncing') return;
    const interval = setInterval(() => void refreshStatus(), 2000);
    return () => clearInterval(interval);
  }, [refreshStatus, status]);

  async function saveMapping() {
    if (!selectedCalendarId || !selectedProjectId) {
      onError('Select a calendar and project ID.');
      return;
    }
    const suggestion = suggestions.find((item) => item.calendarId === selectedCalendarId);
    await apiFetch('/v1/integrations/google-calendar/calendar-mappings', {
      method: 'POST',
      body: JSON.stringify({
        beaconProjectId: selectedProjectId,
        calendarId: selectedCalendarId,
        calendarName: suggestion?.calendarName,
        domainOverrides: domainOverrideInput
          ? domainOverrideInput.split(/[,\s]+/).map((item) => item.trim().toLowerCase()).filter(Boolean)
          : undefined,
      }),
    });
    onMessage('Calendar mapping saved.');
    await refreshStatus();
  }

  async function startSync() {
    setSyncing(true);
    onError(null);
    try {
      await apiFetch('/v1/integrations/google-calendar/sync', {
        method: 'POST',
        body: JSON.stringify({ jobType: 'bulk' }),
      });
      onMessage('Google Calendar sync completed.');
      await refreshStatus();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }

  async function disconnect() {
    if (!confirmIntegrationDisconnect('Google Calendar')) return;
    await apiFetch('/v1/integrations/google-calendar/disconnect', { method: 'DELETE' });
    onMessage('Google Calendar disconnected.');
    await refreshStatus();
  }

  if (loading && !status) {
    return (
      <IntegrationCollapsibleSection
        id="google-calendar"
        title="Google Calendar"
        description="Meeting frequency and customer engagement signals."
      >
        <p className="text-sm text-muted-foreground">Loading…</p>
      </IntegrationCollapsibleSection>
    );
  }

  return (
    <IntegrationCollapsibleSection
      id="google-calendar"
      title="Google Calendar"
      description="Meeting frequency and customer engagement signals for risk detection."
      defaultOpen={Boolean(status?.connected)}
      statusBadge={
        <span
          className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${integrationStatusClass(loading ? 'loading' : status?.status)}`}
        >
          {loading ? 'Loading…' : integrationStatusLabel(status?.status)}
        </span>
      }
    >

      {status?.connected ? (
        <div className="mt-6 space-y-4">
          {status.domainCollisionWarning ? (
            <DomainCollisionBanner message={status.domainCollisionWarning.message} />
          ) : null}
          {status.metadata?.accountEmail ? (
            <p className="text-sm text-muted-foreground">Account: {status.metadata.accountEmail}</p>
          ) : null}
          {status.signals && status.signals.length > 0 ? (
            <ul className="space-y-2 text-sm text-muted-foreground">
              {status.signals.map((signal) => (
                <li key={signal.calendarId}>
                  {signal.calendarName ?? signal.calendarId}: {signal.meetingCount30d ?? 0} meetings (30d)
                </li>
              ))}
            </ul>
          ) : null}
          {isAdmin ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-2 text-sm">
                  <span className="form-label">Calendar</span>
                  <select
                    className="form-input"
                    value={selectedCalendarId}
                    onChange={(event) => {
                      setSelectedCalendarId(event.target.value);
                      const suggestion = suggestions.find((item) => item.calendarId === event.target.value);
                      if (suggestion?.suggestedProjectId) setSelectedProjectId(suggestion.suggestedProjectId);
                    }}
                  >
                    <option value="">Select calendar</option>
                    {suggestions.map((item) => (
                      <option key={item.calendarId} value={item.calendarId}>
                        {item.calendarName}
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
                    placeholder="Project UUID"
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
              </label>
            </div>
          ) : null}
          {isAdmin ? (
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => void saveMapping()} className="btn-secondary">
                Save calendar mapping
              </button>
              <button
                type="button"
                onClick={() => void startSync()}
                disabled={syncing || status.status === 'syncing'}
                className="btn-primary"
              >
                {status.status === 'syncing' ? 'Syncing…' : 'Run calendar sync'}
              </button>
              <button type="button" onClick={() => void disconnect()} className="btn-secondary">
                Disconnect
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <>
          <IntegrationConnectPanel
            apiFetch={apiFetch}
            isAdmin={isAdmin}
            connected={Boolean(status?.connected)}
            connectPath="google-calendar"
            connectSource="google_calendar"
            integrationName="Google Calendar"
            onMessage={onMessage}
            onError={onError}
            onConnected={refreshStatus}
            mockHelpText="Uses seeded calendar events locally. Configure OAuth for real Google Calendar access."
          />
          {!isAdmin ? (
            <p className="mt-6 text-sm text-muted-foreground">
              Calendar status is read-only for your role. Ask an admin to connect Google Calendar.
            </p>
          ) : null}
        </>
      )}
    </IntegrationCollapsibleSection>
  );
}
