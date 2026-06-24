'use client';

import { useActiveMembership, useAppSession } from '@/components/providers/app-session-provider';
import { useApiClient } from '@/lib/use-api-client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { JiraIntegrationsSection } from './jira-integrations-section';
import { LinearIntegrationsSection } from './linear-integrations-section';
import { SlackIntegrationsSection } from './slack-integrations-section';
import { GoogleCalendarIntegrationsSection } from './google-calendar-integrations-section';
import Link from 'next/link';
import {
  confirmCoreCrmReconnect,
  confirmIntegrationDisconnect,
  CORE_CRM_CONNECTED_LABELS,
  coreCrmOrgChangeWarning,
} from '@/lib/integration-dialogs';
import { CoreCrmAutoMappingSection } from '@/components/integrations/core-crm-auto-mapping-section';
import { ContributorReadOnlyBanner } from '@/components/contributor-read-only-banner';
import { AppPageHeader } from '@/components/app-page-header';
import { ContextualDocsLink } from '@/components/contextual-docs-link';
import { FeedbackBanner } from '@/components/feedback-banner';
import {
  IntegrationCatalogGrid,
  type CatalogCategory,
} from '@/components/integrations/integration-catalog-grid';
import { SetupReadinessChecklist } from '@/components/integrations/setup-readiness-checklist';
import { DevMockIntegrationsBanner } from '@/components/integrations/dev-mock-integrations-banner';
import { CoreCrmPreferenceSection } from '@/components/integrations/core-crm-preference-section';
import { IntegrationCollapsibleSection } from '@/components/integrations/integration-collapsible-section';
import { runDemoSetup } from '@/lib/demo-setup';
import { evaluateSetupReadiness } from '@/lib/setup-readiness';
import {
  integrationStatusClass,
  integrationStatusLabel,
  type IntegrationConnectionStatus,
} from '@/lib/integration-status-styles';
import { connectCatalogIntegration } from '@/lib/integration-connect';
import { CATALOG_CONNECT_PATHS, type IntegrationCatalogId } from '@beacon/shared/integrations';
import { bootstrapAfterConnect } from '@/lib/setup-orchestrator';

type IntegrationStatus = {
  connected: boolean;
  status: 'connected' | 'degraded' | 'disconnected' | 'syncing';
  lastSyncAt?: string | null;
  lastError?: string | null;
  externalOrgId?: string | null;
  metadata?: {
    environment: string;
    mappingComplete: boolean;
    implementationStages: string[];
  } | null;
  latestJob?: {
    id: string;
    jobType: string;
    status: string;
    recordsProcessed: number;
    recordsTotal: number | null;
    error?: string | null;
  } | null;
  syncProgress?: {
    status: string;
    recordsProcessed?: number;
    recordsTotal?: number | null;
    error?: string | null;
  } | null;
};

const CORE_CRM_IDS = new Set(['salesforce', 'hubspot', 'microsoft_dynamics', 'pipedrive']);

function coreCrmApiPath(coreCrmId: string): string | null {
  return CATALOG_CONNECT_PATHS[coreCrmId as IntegrationCatalogId] ?? null;
}

export function IntegrationsContent() {
  const { activeTenantId, authDevMode } = useAppSession();
  const membership = useActiveMembership();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [jiraStatus, setJiraStatus] = useState<{
    connected: boolean;
    status: string;
    unlinkedBeaconProjectCount?: number;
    orphans?: unknown[];
  } | null>(null);
  const [linearStatus, setLinearStatus] = useState<{ connected: boolean; status: string } | null>(
    null,
  );
  const [slackStatus, setSlackStatus] = useState<{ connected: boolean; status: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [demoSetupBusy, setDemoSetupBusy] = useState(false);
  const [catalogCategories, setCatalogCategories] = useState<CatalogCategory[]>([]);
  const [connectBusyId, setConnectBusyId] = useState<string | null>(null);
  const [coreCrmReadiness, setCoreCrmReadiness] = useState<{
    coreCrmId: string;
    coreCrmName?: string;
    snapshot: {
      connected: boolean;
      status: string;
      lastSyncAt?: string | null;
      mappingComplete?: boolean;
      syncProgress?: { recordsProcessed?: number; recordsTotal?: number | null };
    };
  } | null>(null);

  const isAdmin = membership?.role === 'admin';
  const { apiFetch } = useApiClient();

  const refreshStatus = useCallback(async () => {
    if (!activeTenantId) return;
    setLoading(true);
    try {
      const [coreCrmReadiness, jira, linear, slack, catalog] = await Promise.all([
        apiFetch('/v1/integrations/core-crm/readiness') as Promise<{
          coreCrmId: string;
          coreCrmName?: string;
          snapshot: {
            connected: boolean;
            status: string;
            lastSyncAt?: string | null;
            mappingComplete?: boolean;
            syncProgress?: { recordsProcessed?: number; recordsTotal?: number | null };
          };
        }>,
        apiFetch('/v1/integrations/jira/status') as Promise<{ connected: boolean; status: string }>,
        apiFetch('/v1/integrations/linear/status') as Promise<{ connected: boolean; status: string }>,
        apiFetch('/v1/integrations/slack/status') as Promise<{ connected: boolean; status: string }>,
        apiFetch('/v1/integrations/catalog') as Promise<{ categories: CatalogCategory[] }>,
      ]);
      const apiPath = coreCrmApiPath(coreCrmReadiness.coreCrmId);
      const coreDetail = apiPath
        ? ((await apiFetch(`/v1/integrations/${apiPath}/status`)) as IntegrationStatus)
        : null;
      setStatus(coreDetail);
      setCoreCrmReadiness(coreCrmReadiness);
      setJiraStatus(jira);
      setLinearStatus(linear);
      setSlackStatus(slack);
      setCatalogCategories(catalog.categories ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load integration status');
    } finally {
      setLoading(false);
    }
  }, [activeTenantId, apiFetch]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    const connected = searchParams.get('connected');
    const orgChanged = searchParams.get('org_changed');
    const oauthError = searchParams.get('error');
    const jiraConnected = searchParams.get('jira_connected');
    const linearConnected = searchParams.get('linear_connected');
    const linearError = searchParams.get('linear_error');
    const jiraError = searchParams.get('jira_error');
    const slackConnected = searchParams.get('slack_connected');
    const slackError = searchParams.get('slack_error');
    const googleCalendarConnected = searchParams.get('google_calendar_connected');
    const googleCalendarError = searchParams.get('google_calendar_error');
    if (connected && CORE_CRM_CONNECTED_LABELS[connected]) {
      const crmName = CORE_CRM_CONNECTED_LABELS[connected]!;
      setMessage(`${crmName} connected successfully.`);
      if (orgChanged === '1') {
        setWarning(coreCrmOrgChangeWarning(crmName));
      }
    }
    if (jiraConnected) {
      setMessage('Jira connected successfully.');
    }
    if (linearConnected) {
      setMessage('Linear connected successfully.');
    }
    if (linearError) {
      setError(decodeURIComponent(linearError));
    }
    if (oauthError) {
      setError(decodeURIComponent(oauthError));
    }
    if (jiraError) {
      setError(decodeURIComponent(jiraError));
    }
    if (slackConnected) {
      setMessage('Slack connected successfully.');
    }
    if (slackError) {
      setError(decodeURIComponent(slackError));
    }
    if (googleCalendarConnected) {
      setMessage('Google Calendar connected successfully.');
    }
    if (googleCalendarError) {
      setError(decodeURIComponent(googleCalendarError));
    }
  }, [searchParams]);

  const coreCrmId = coreCrmReadiness?.coreCrmId ?? 'salesforce';
  const coreCrmName = coreCrmReadiness?.coreCrmName ?? 'CRM';
  const coreSnapshot = coreCrmReadiness?.snapshot;

  useEffect(() => {
    if (!status || (status.status !== 'syncing' && coreSnapshot?.status !== 'syncing')) return;
    const interval = setInterval(() => {
      void refreshStatus();
    }, 2000);
    return () => clearInterval(interval);
  }, [coreSnapshot?.status, refreshStatus, status]);

  async function connectCoreCrm() {
    if (!CORE_CRM_IDS.has(coreCrmId)) return;
    if (status?.connected && !confirmCoreCrmReconnect(coreCrmName)) return;
    setMessage(null);
    setError(null);
    try {
      const result = await connectCatalogIntegration(apiFetch, coreCrmId);
      if (result === 'mock-connected') {
        setMessage(`${coreCrmName} connected. Auto-configuring mappings and starting import…`);
        await bootstrapAfterConnect(apiFetch);
        await refreshStatus();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connect failed');
    }
  }

  async function startSync() {
    const apiPath = coreCrmApiPath(coreCrmId);
    if (!apiPath) return;
    setMessage(null);
    setError(null);
    setSyncing(true);
    try {
      await apiFetch(`/v1/integrations/${apiPath}/sync`, {
        method: 'POST',
        body: JSON.stringify({ jobType: 'bulk', async: true }),
      });
      setMessage('Sync started.');
      await refreshStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }

  async function disconnect() {
    const apiPath = coreCrmApiPath(coreCrmId);
    if (!apiPath) return;
    if (!confirmIntegrationDisconnect(coreCrmName)) return;
    setMessage(null);
    setError(null);
    try {
      await apiFetch(`/v1/integrations/${apiPath}/disconnect`, { method: 'DELETE' });
      setMessage(`${coreCrmName} disconnected.`);
      await refreshStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Disconnect failed');
    }
  }

  async function connectFromCatalog(catalogId: string) {
    setMessage(null);
    setError(null);
    setConnectBusyId(catalogId);
    try {
      const result = await connectCatalogIntegration(apiFetch, catalogId);
      if (result === 'mock-connected') {
        const name =
          catalogCategories
            .flatMap((category) => category.integrations)
            .find((item) => item.id === catalogId)?.name ?? 'Integration';
        setMessage(`${name} connected. Auto-configuring…`);
        await bootstrapAfterConnect(apiFetch);
        await refreshStatus();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connect failed');
    } finally {
      setConnectBusyId(null);
    }
  }

  async function connectAllDemo() {
    setMessage(null);
    setError(null);
    setDemoSetupBusy(true);
    try {
      await runDemoSetup(apiFetch, undefined, coreCrmId);
      setMessage('Demo integrations connected and initial sync started.');
      await refreshStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Demo setup failed');
    } finally {
      setDemoSetupBusy(false);
    }
  }

  const salesforceProgress = status?.syncProgress ?? null;
  const progress = salesforceProgress ?? coreSnapshot?.syncProgress ?? null;
  const progressTotal = progress?.recordsTotal ?? status?.latestJob?.recordsTotal ?? null;
  const progressProcessed =
    progress?.recordsProcessed ?? status?.latestJob?.recordsProcessed ?? 0;
  const coreStatus = status?.status ?? coreSnapshot?.status;
  const progressPercent =
    progressTotal && progressTotal > 0
      ? Math.min(100, Math.round((progressProcessed / progressTotal) * 100))
      : coreStatus === 'syncing'
        ? 15
        : 0;

  const setupReadiness = useMemo(() => {
    if (loading || !coreCrmReadiness) return null;
    return evaluateSetupReadiness({
      coreCrmId: coreCrmReadiness.coreCrmId,
      coreCrm: {
        connected: coreCrmReadiness.snapshot.connected,
        status: coreCrmReadiness.snapshot.status,
        mappingComplete: Boolean(coreCrmReadiness.snapshot.mappingComplete),
        lastSyncAt: coreCrmReadiness.snapshot.lastSyncAt ?? null,
        syncProgress: coreCrmReadiness.snapshot.syncProgress ?? null,
      },
      workItems: {
        connected: (jiraStatus?.connected ?? false) || (linearStatus?.connected ?? false),
        status:
          jiraStatus?.connected || linearStatus?.connected
            ? jiraStatus?.status ?? linearStatus?.status ?? 'connected'
            : 'disconnected',
      },
      engagement: {
        connected: slackStatus?.connected ?? false,
        status: slackStatus?.status ?? 'disconnected',
      },
      unlinkedJiraProjectCount: jiraStatus?.unlinkedBeaconProjectCount ?? 0,
      jiraOrphanProjectCount: jiraStatus?.orphans?.length ?? 0,
    });
  }, [coreCrmReadiness, jiraStatus, linearStatus, loading, slackStatus]);

  const mappingsComplete = Boolean(status?.metadata?.mappingComplete ?? true);

  return (
    <div className="space-y-8">
      <AppPageHeader
        title="Connections"
        description="Connect tools from the library below. Mappings and project links are configured automatically — use the setup flow for the fastest path to a live dashboard."
      >
        <ContextualDocsLink />
        <Link href="/integrations/setup" className="btn-primary">
          Continue setup
        </Link>
      </AppPageHeader>

      {isAdmin && authDevMode ? (
        <div className="flex justify-end">
          <button
            type="button"
            disabled={demoSetupBusy}
            onClick={() => void connectAllDemo()}
            className="btn-secondary"
          >
            {demoSetupBusy ? 'Setting up demo…' : 'Load demo data'}
          </button>
        </div>
      ) : null}

      {message ? (
        <FeedbackBanner variant="success" message={message} onDismiss={() => setMessage(null)} />
      ) : null}
      {warning ? (
        <FeedbackBanner variant="warning" message={warning} onDismiss={() => setWarning(null)} />
      ) : null}
      {error ? (
        <FeedbackBanner variant="error" message={error} onDismiss={() => setError(null)} />
      ) : null}

      {!isAdmin ? (
        <ContributorReadOnlyBanner
          context="integration status and field mappings"
          adminHint="To connect your CRM, run syncs, or change mappings, ask your workspace admin."
        />
      ) : null}

      {isAdmin && authDevMode ? <DevMockIntegrationsBanner /> : null}

      {setupReadiness ? <SetupReadinessChecklist readiness={setupReadiness} /> : null}

      {isAdmin ? (
        <CoreCrmPreferenceSection
          apiFetch={apiFetch}
          isAdmin={isAdmin}
          onUpdated={() => void refreshStatus()}
        />
      ) : null}

      <section className="settings-section">
        <h2 className="settings-section-title">Integration library</h2>
        <p className="settings-section-lead">
          Browse available and upcoming connectors. Each integration unlocks specific risk signals
          — connect what your team uses today; additional CRMs and tools are on the roadmap.
        </p>
        {loading && catalogCategories.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Loading integration catalog…</p>
        ) : (
          <div className="mt-6">
            <IntegrationCatalogGrid
              categories={catalogCategories}
              isAdmin={isAdmin}
              onConnect={(id) => void connectFromCatalog(id)}
              connectBusyId={connectBusyId}
            />
          </div>
        )}
      </section>

      <div>
        <h2 className="text-lg font-semibold text-foreground">Connection details</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Expand a connector for sync controls. Most teams only need the setup flow above.
        </p>
      </div>

      {CORE_CRM_IDS.has(coreCrmId) ? (
      <IntegrationCollapsibleSection
        id={coreCrmId}
        title={coreCrmName}
        description="Core CRM import — field mappings are auto-configured and monitored on every sync."
        defaultOpen={Boolean(status?.connected)}
        highlight={Boolean(status?.lastError)}
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
            <dt className="text-muted-foreground">
              {coreCrmId === 'hubspot'
                ? 'Portal ID'
                : coreCrmId === 'pipedrive'
                  ? 'Company ID'
                  : 'Org ID'}
            </dt>
            <dd>{status?.externalOrgId ?? '—'}</dd>
          </div>
          {coreCrmId === 'salesforce' ? (
          <div>
            <dt className="text-muted-foreground">Environment</dt>
            <dd>{status?.metadata?.environment ?? '—'}</dd>
          </div>
          ) : null}
          <div>
            <dt className="text-muted-foreground">Last sync</dt>
            <dd>
              {status?.lastSyncAt ? new Date(status.lastSyncAt).toLocaleString() : 'Never'}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Data mapping</dt>
            <dd>{status?.metadata?.mappingComplete ? 'Auto-configured' : 'Configuring…'}</dd>
          </div>
        </dl>

        {(status?.status === 'syncing' ||
          coreSnapshot?.status === 'syncing' ||
          salesforceProgress?.status === 'running') && (
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

        {status?.lastError ? (
          <div className="mt-4 flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-destructive">
              <span className="font-medium">Last sync failed.</span> {status.lastError}
            </p>
            <div className="flex flex-wrap gap-2 shrink-0">
              {isAdmin && mappingsComplete ? (
                <button
                  type="button"
                  onClick={() => void startSync()}
                  disabled={syncing || status.status === 'syncing'}
                  className="btn-secondary"
                >
                  Retry sync
                </button>
              ) : null}
              <Link href="/docs?guide=connect-stack&step=2" className="btn-secondary">
                Setup help
              </Link>
            </div>
          </div>
        ) : null}

        {isAdmin ? (
          <div className="mt-6 space-y-3">
            <div className="flex flex-wrap gap-3">
              {!status?.connected ? (
                <button type="button" onClick={() => void connectCoreCrm()} className="btn-primary">
                  Connect {coreCrmName}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => void startSync()}
                    disabled={syncing || status.status === 'syncing' || !mappingsComplete}
                    className="btn-primary"
                  >
                    {status.status === 'syncing' ? 'Syncing…' : 'Run bulk sync'}
                  </button>
                  <button type="button" onClick={() => void disconnect()} className="btn-secondary">
                    Disconnect
                  </button>
                </>
              )}
            </div>
            {status?.connected && !mappingsComplete ? (
              <p className="text-sm text-muted-foreground">
                Mappings are being auto-configured. Sync will start automatically when ready.
              </p>
            ) : null}
          </div>
        ) : (
          <p className="mt-6 text-sm text-muted-foreground">
            Connection status is read-only for your role. Ask an admin to connect or sync.
          </p>
        )}

        <CoreCrmAutoMappingSection
          apiFetch={apiFetch}
          coreCrmId={coreCrmId}
          coreCrmName={coreCrmName}
        />
      </IntegrationCollapsibleSection>
      ) : (
        <IntegrationCollapsibleSection
          id={coreCrmId}
          title={coreCrmName}
          description={`Core CRM import for ${coreCrmName}. Connect when this integration ships in the catalog.`}
          defaultOpen={Boolean(coreSnapshot?.connected)}
          statusBadge={
            <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${integrationStatusClass(loading ? 'loading' : (coreSnapshot?.status as IntegrationConnectionStatus | undefined))}`}
            >
              {loading ? 'Loading…' : integrationStatusLabel(coreSnapshot?.status as IntegrationConnectionStatus | undefined)}
            </span>
          }
        >
          <p className="text-sm text-muted-foreground">
            {coreCrmName} is your workspace core CRM. This connector is not available yet — change
            your preference above or use Salesforce until additional CRMs launch.
          </p>
        </IntegrationCollapsibleSection>
      )}

      <JiraIntegrationsSection
        apiFetch={apiFetch}
        isAdmin={isAdmin}
        onMessage={setMessage}
        onError={setError}
      />

      <LinearIntegrationsSection
        apiFetch={apiFetch}
        isAdmin={isAdmin}
        onMessage={setMessage}
        onError={setError}
      />

      <SlackIntegrationsSection
        apiFetch={apiFetch}
        isAdmin={isAdmin}
        onMessage={setMessage}
        onError={setError}
      />

      <GoogleCalendarIntegrationsSection
        apiFetch={apiFetch}
        isAdmin={isAdmin}
        onMessage={setMessage}
        onError={setError}
      />
    </div>
  );
}
