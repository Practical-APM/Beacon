'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Sparkles, Zap } from 'lucide-react';
import { useActiveMembership, useAppSession } from '@/components/providers/app-session-provider';
import { useApiClient } from '@/lib/use-api-client';
import { ContributorReadOnlyBanner } from '@/components/contributor-read-only-banner';
import { DevMockIntegrationsBanner } from '@/components/integrations/dev-mock-integrations-banner';
import { AppPageHeader } from '@/components/app-page-header';
import { ContextualDocsLink } from '@/components/contextual-docs-link';
import { FeedbackBanner } from '@/components/feedback-banner';
import { runDemoSetup, getDemoPhaseLabel, type DemoSetupPhase } from '@/lib/demo-setup';
import { connectCatalogIntegration } from '@/lib/integration-connect';
import {
  CORE_CRM_CONNECTED_LABELS,
  coreCrmOrgChangeWarning,
} from '@/lib/integration-dialogs';
import {
  bootstrapAfterConnect,
  fetchCoreCrmPreference,
  fetchSetupState,
  setCoreCrmPreference,
  type SetupPhase,
  type SetupState,
} from '@/lib/setup-orchestrator';
import { cn } from '@/lib/utils';
import { CoreCrmPicker } from '@/components/integrations/core-crm-picker';
import type { CoreCrmPreferenceState } from '@/components/integrations/core-crm-picker';

const PHASES: Array<{ id: SetupPhase; title: string; detail: string }> = [
  {
    id: 'connect_core_crm',
    title: 'Connect your CRM',
    detail: 'OAuth connects in one click. Beacon auto-configures field mappings — no manual setup.',
  },
  {
    id: 'importing',
    title: 'Import projects',
    detail: 'We import active implementation opportunities and keep mappings in sync automatically.',
  },
  {
    id: 'enhance_signals',
    title: 'Enhance risk signals',
    detail: 'Optional: connect Jira and Slack for delivery and engagement signals. Mappings are applied automatically.',
  },
  {
    id: 'ready',
    title: 'Launch risk center',
    detail: 'Your portfolio dashboard is ready.',
  },
];

export function OnboardingWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { authDevMode } = useAppSession();
  const membership = useActiveMembership();
  const [setupState, setSetupState] = useState<SetupState | null>(null);
  const [crmPreference, setCrmPreference] = useState<CoreCrmPreferenceState | null>(null);
  const [selectedCrmId, setSelectedCrmId] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [demoPhase, setDemoPhase] = useState<DemoSetupPhase | null>(null);

  const isAdmin = membership?.role === 'admin';
  const { apiFetch } = useApiClient();

  const refreshSetup = useCallback(async () => {
    try {
      const [state, preference] = await Promise.all([
        fetchSetupState(apiFetch),
        fetchCoreCrmPreference(apiFetch),
      ]);
      setSetupState(state);
      setCrmPreference(preference);
      setSelectedCrmId(preference.coreCrmId);
      setError(null);
      return state;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Could not load setup status. Try refreshing the page.';
      setError(message);
      return null;
    }
  }, [apiFetch]);

  useEffect(() => {
    void refreshSetup();
  }, [refreshSetup]);

  useEffect(() => {
    const connected = searchParams.get('connected');
    const orgChanged = searchParams.get('org_changed');
    const jiraConnected = searchParams.get('jira_connected');
    const linearConnected = searchParams.get('linear_connected');
    const slackConnected = searchParams.get('slack_connected');

    if (connected && CORE_CRM_CONNECTED_LABELS[connected]) {
      const crmName = CORE_CRM_CONNECTED_LABELS[connected]!;
      setMessage(`${crmName} connected. Configuring mappings and starting import…`);
      if (orgChanged === '1') {
        setWarning(coreCrmOrgChangeWarning(crmName));
      }
      void bootstrapAfterConnect(apiFetch)
        .then(() => refreshSetup())
        .catch((err) => setError(err instanceof Error ? err.message : 'Setup failed'));
    }
    if (jiraConnected) {
      setMessage('Jira connected. Auto-mapping projects…');
      void bootstrapAfterConnect(apiFetch)
        .then(() => refreshSetup())
        .catch((err) => setError(err instanceof Error ? err.message : 'Setup failed'));
    }
    if (linearConnected) {
      setMessage('Linear connected. Auto-mapping teams…');
      void bootstrapAfterConnect(apiFetch)
        .then(() => refreshSetup())
        .catch((err) => setError(err instanceof Error ? err.message : 'Setup failed'));
    }
    if (slackConnected) {
      setMessage('Slack connected. Auto-mapping channels…');
      void bootstrapAfterConnect(apiFetch)
        .then(() => refreshSetup())
        .catch((err) => setError(err instanceof Error ? err.message : 'Setup failed'));
    }
  }, [apiFetch, refreshSetup, searchParams]);

  useEffect(() => {
    if (!setupState?.syncInProgress && setupState?.phase !== 'importing') return;
    const interval = setInterval(() => {
      void refreshSetup();
    }, 2500);
    return () => clearInterval(interval);
  }, [refreshSetup, setupState?.phase, setupState?.syncInProgress]);

  useEffect(() => {
    if (setupState?.phase === 'ready') {
      const timeout = setTimeout(() => router.replace('/dashboard'), 1200);
      return () => clearTimeout(timeout);
    }
  }, [router, setupState?.phase]);

  const connectCoreCrm = useCallback(async () => {
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      if (crmPreference && selectedCrmId !== crmPreference.coreCrmId) {
        const updated = await setCoreCrmPreference(apiFetch, selectedCrmId);
        setCrmPreference(updated);
      }

      const coreCrmId = selectedCrmId || setupState?.coreCrmId || crmPreference?.coreCrmId;
      if (!coreCrmId) throw new Error('Select a CRM to continue');

      const result = await connectCatalogIntegration(apiFetch, coreCrmId);
      if (result === 'mock-connected') {
        const name =
          crmPreference?.options.find((option) => option.id === coreCrmId)?.name ??
          setupState?.coreCrmName ??
          'CRM';
        setMessage(`${name} connected. Auto-configuring and importing…`);
        await bootstrapAfterConnect(apiFetch);
        await refreshSetup();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connect failed');
    } finally {
      setBusy(false);
    }
  }, [apiFetch, crmPreference, refreshSetup, selectedCrmId, setupState?.coreCrmId, setupState?.coreCrmName]);

  const connectOptional = useCallback(async (catalogId: 'jira' | 'slack') => {
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      const result = await connectCatalogIntegration(apiFetch, catalogId);
      if (result === 'mock-connected') {
        await bootstrapAfterConnect(apiFetch);
        await refreshSetup();
        setMessage(`${catalogId === 'jira' ? 'Jira' : 'Slack'} connected and auto-mapped.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connect failed');
    } finally {
      setBusy(false);
    }
  }, [apiFetch, refreshSetup]);

  const skipToDashboard = useCallback(() => {
    router.push('/dashboard');
  }, [router]);

  async function completeDemoSetup() {
    setError(null);
    setMessage(null);
    setBusy(true);
    setDemoPhase('core_crm');
    try {
      const coreCrmId = selectedCrmId || crmPreference?.coreCrmId || 'salesforce';
      await runDemoSetup(apiFetch, setDemoPhase, coreCrmId);
      await bootstrapAfterConnect(apiFetch);
      setMessage('Demo workspace ready. Opening dashboard…');
      setTimeout(() => router.push('/dashboard'), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Demo setup failed');
      setDemoPhase(null);
    } finally {
      setBusy(false);
    }
  }

  const activePhaseIndex = useMemo(() => {
    if (!setupState) return 0;
    return PHASES.findIndex((phase) => phase.id === setupState.phase);
  }, [setupState]);

  const phaseContent = useMemo(() => {
    if (!setupState) {
      return (
        <p className="text-sm text-muted-foreground">Checking your workspace setup…</p>
      );
    }

    switch (setupState.phase) {
      case 'connect_core_crm':
        return (
          <div className="space-y-4">
            <p className="settings-section-lead">
              Choose your core CRM, then connect in one click. Beacon auto-configures field mappings —
              no manual setup.
            </p>
            {crmPreference ? (
              <CoreCrmPicker
                preference={crmPreference}
                selectedId={selectedCrmId}
                disabled={busy || crmPreference.locked}
                compact
                onSelect={setSelectedCrmId}
              />
            ) : null}
            {crmPreference?.locked && crmPreference.lockedReason ? (
              <p className="text-sm text-muted-foreground">{crmPreference.lockedReason}</p>
            ) : null}
            {isAdmin ? (
              <button
                type="button"
                disabled={busy || !selectedCrmId}
                onClick={() => void connectCoreCrm()}
                className="btn-primary"
              >
                {busy
                  ? 'Connecting…'
                  : `Connect ${
                      crmPreference?.options.find((option) => option.id === selectedCrmId)?.name ??
                      setupState.coreCrmName
                    }`}
              </button>
            ) : (
              <p className="text-sm text-muted-foreground">Ask an admin to connect your CRM.</p>
            )}
          </div>
        );
      case 'importing':
        return (
          <div className="space-y-4">
            <p className="settings-section-lead">{setupState.message}</p>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden />
              Field mappings are managed automatically — no action needed.
            </div>
            <Link href="/dashboard" className="btn-secondary inline-flex">
              Open dashboard while importing
            </Link>
            <p className="text-xs text-muted-foreground">
              Optional:{' '}
              <Link href="/settings?tab=notifications" className="font-medium text-primary hover:underline">
                enable email when sync completes
              </Link>
            </p>
          </div>
        );
      case 'enhance_signals':
        return (
          <div className="space-y-4">
            <div
              role="status"
              className="motion-safe:animate-fade-in flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-success"
            >
              <Check className="h-4 w-4 shrink-0" aria-hidden />
              Core setup complete. Your risk feed is live.
            </div>
            <p className="settings-section-lead">{PHASES[2]?.detail}</p>
            {isAdmin ? (
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void connectOptional('jira')}
                  className="btn-secondary"
                >
                  Connect Jira
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void connectOptional('slack')}
                  className="btn-secondary"
                >
                  Connect Slack
                </button>
                <button type="button" onClick={() => void skipToDashboard()} className="btn-primary">
                  Go to dashboard
                </button>
              </div>
            ) : (
              <Link href="/dashboard" className="btn-primary inline-flex">
                Go to dashboard
              </Link>
            )}
          </div>
        );
      default:
        return (
          <div className="space-y-4">
            <div
              role="status"
              className="motion-safe:animate-fade-in flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-success"
            >
              <Check className="h-4 w-4 shrink-0" aria-hidden />
              {setupState.message}
            </div>
            <Link href="/dashboard" className="btn-primary inline-flex">
              Open dashboard
            </Link>
          </div>
        );
    }
  }, [busy, connectCoreCrm, connectOptional, crmPreference, isAdmin, selectedCrmId, setupState, skipToDashboard]);

  return (
    <div className="space-y-8">
      <AppPageHeader
        title="Get started"
        description="One guided flow — connect tools, auto-configure mappings, and launch your risk center. No manual field mapping required."
      >
        <ContextualDocsLink />
        <Link href="/integrations" className="btn-secondary">
          Manage connections
        </Link>
      </AppPageHeader>

      {message ? <FeedbackBanner variant="success" message={message} onDismiss={() => setMessage(null)} /> : null}
      {warning ? (
        <FeedbackBanner variant="warning" message={warning} onDismiss={() => setWarning(null)} />
      ) : null}
      {error ? <FeedbackBanner variant="error" message={error} onDismiss={() => setError(null)} /> : null}

      {!isAdmin ? (
        <ContributorReadOnlyBanner
          context="workspace setup"
          adminHint="An admin needs to connect integrations. You will be redirected to the dashboard once setup is complete."
        />
      ) : null}

      {isAdmin && authDevMode ? <DevMockIntegrationsBanner /> : null}

      {isAdmin && authDevMode ? (
        <section className="settings-section border-primary/20 bg-primary/5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Sparkles className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <h2 className="settings-section-title">Local demo shortcut</h2>
                <p className="settings-section-lead">
                  Loads sample Salesforce, Jira, and Slack with automatic mappings — no OAuth.
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => void completeDemoSetup()}
              className="btn-primary shrink-0"
            >
              {busy && demoPhase ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  {getDemoPhaseLabel(demoPhase, crmPreference?.coreCrmName ?? 'CRM')}
                </>
              ) : (
                <>
                  <Zap className="mr-2 h-4 w-4" aria-hidden />
                  Load demo data
                </>
              )}
            </button>
          </div>
        </section>
      ) : null}

      <section className="settings-section overflow-hidden p-0">
        <div className="border-b border-border px-5 py-4 sm:px-6">
          <p className="text-sm font-semibold">Setup progress</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {setupState?.message ?? 'Preparing your workspace…'}
          </p>
        </div>

        <ol className="grid gap-0 border-b border-border sm:grid-cols-4 sm:divide-x sm:divide-border">
          {PHASES.map((phase, index) => {
            const done = activePhaseIndex > index;
            const active = activePhaseIndex === index;
            return (
              <li key={phase.id}>
                <div
                  className={cn(
                    'flex w-full flex-col items-start gap-2 px-4 py-4 sm:px-3',
                    active ? 'bg-primary/10' : done ? 'bg-emerald-500/5' : 'bg-background',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold',
                      done
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700'
                        : active
                          ? 'border-primary/40 bg-background text-primary'
                          : 'border-border text-muted-foreground',
                    )}
                  >
                    {done ? <Check className="h-4 w-4" aria-hidden /> : index + 1}
                  </span>
                  <span className="text-xs font-medium text-foreground sm:text-sm">{phase.title}</span>
                </div>
              </li>
            );
          })}
        </ol>

        <div className="p-6 sm:p-8">{phaseContent}</div>
      </section>
    </div>
  );
}
