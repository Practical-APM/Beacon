'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { AppSection } from '@/components/app-section';
import { FeedbackBanner } from '@/components/feedback-banner';
import { useApiClient } from '@/lib/use-api-client';

interface BenchmarkAdminStatus {
  enabled: boolean;
  participationEnabled: boolean;
  latestSnapshotDate: string | null;
  cohortSampleTenants: number;
}

export function BenchmarkAdminSection() {
  const { apiFetch, ready } = useApiClient();
  const [status, setStatus] = useState<BenchmarkAdminStatus | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!ready) return;
    const response = await apiFetch<{ status: BenchmarkAdminStatus }>('/v1/admin/benchmarks/status');
    setStatus(response.status);
  }, [apiFetch, ready]);

  useEffect(() => {
    void load().catch((err) =>
      setError(err instanceof Error ? err.message : 'Failed to load benchmark status'),
    );
  }, [load]);

  async function refreshSnapshot() {
    setRefreshing(true);
    setMessage(null);
    setError(null);
    try {
      await apiFetch('/v1/admin/benchmarks/refresh', { method: 'POST' });
      setMessage('Benchmark snapshot refreshed. Dashboard comparisons update on next load.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refresh failed');
    } finally {
      setRefreshing(false);
    }
  }

  if (!status) {
    return <p className="text-sm text-muted-foreground">Loading benchmark settings…</p>;
  }

  const cohortReady = status.cohortSampleTenants >= 3;

  return (
    <AppSection
      title="Portfolio benchmarking"
      description="Compare your at-risk rate and delay metrics against anonymized peers. Participation is opt-in — no customer names or project details leave your tenant."
      contentClassName="space-y-4"
    >
      {message ? (
        <FeedbackBanner variant="success" message={message} onDismiss={() => setMessage(null)} />
      ) : null}
      {error ? (
        <FeedbackBanner variant="error" message={error} onDismiss={() => setError(null)} />
      ) : null}

      {!status.participationEnabled ? (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-800 dark:text-amber-200" aria-hidden />
          <p>
            Benchmark participation is off. Enable &quot;Benchmark participation&quot; in feature
            flags below, then refresh the snapshot to appear on the dashboard.
          </p>
        </div>
      ) : cohortReady ? (
        <div className="flex items-start gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-800 dark:text-emerald-300" aria-hidden />
          <p>
            Cohort has enough peers ({status.cohortSampleTenants} tenants). Percentile comparisons
            are shown on the dashboard.
          </p>
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          <p>
            Participation is on, but the cohort needs at least 3 tenants before percentile bands
            appear. Currently {status.cohortSampleTenants} in cohort.
          </p>
        </div>
      )}

      <dl className="grid gap-3 text-sm sm:grid-cols-3">
        <div className="rounded-lg border border-border px-4 py-3">
          <dt className="text-muted-foreground">Participation</dt>
          <dd className="mt-1 font-medium">
            {status.participationEnabled ? 'Enabled' : 'Disabled'}
          </dd>
        </div>
        <div className="rounded-lg border border-border px-4 py-3">
          <dt className="text-muted-foreground">Latest snapshot</dt>
          <dd className="mt-1 font-medium">{status.latestSnapshotDate ?? 'None yet'}</dd>
        </div>
        <div className="rounded-lg border border-border px-4 py-3">
          <dt className="text-muted-foreground">Cohort size</dt>
          <dd className="mt-1 font-medium">{status.cohortSampleTenants} tenants</dd>
        </div>
      </dl>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={!status.enabled || !status.participationEnabled || refreshing}
          onClick={() => void refreshSnapshot()}
          className="btn-primary"
        >
          {refreshing ? 'Refreshing…' : 'Refresh snapshot'}
        </button>
      </div>
    </AppSection>
  );
}
