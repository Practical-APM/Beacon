'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BenchmarkComparisonPanel,
  type PortfolioBenchmarkData,
} from '@/components/dashboard/benchmark-comparison-panel';
import { DashboardFilters, type RiskFeedFilters } from '@/components/dashboard/dashboard-filters';
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';
import { EmptyRiskState } from '@/components/dashboard/empty-risk-state';
import {
  PortfolioMetrics,
  type DashboardSummaryData,
} from '@/components/dashboard/portfolio-metrics';
import { PortfolioMetricsSetupHint } from '@/components/dashboard/portfolio-metrics-setup-hint';
import { RiskCard, topPriorityLabel, type RiskFeedItem } from '@/components/dashboard/risk-card';
import { SetupReadinessBanner } from '@/components/dashboard/setup-readiness-banner';
import { GettingStartedChecklist } from '@/components/dashboard/getting-started-checklist';
import { StaleDataBanner } from '@/components/dashboard/stale-data-banner';
import { SyncProgressBanner } from '@/components/dashboard/sync-progress-banner';
import { isStaleData } from '@/lib/format';
import {
  evaluateSetupReadiness,
  type SetupReadiness,
} from '@/lib/setup-readiness';
import { ContributorReadOnlyBanner } from '@/components/contributor-read-only-banner';
import { ContextualDocsLink } from '@/components/contextual-docs-link';
import { DashboardPrintSummary } from '@/components/dashboard/dashboard-print-summary';
import { useActiveMembership } from '@/components/providers/app-session-provider';
import { FeedbackBanner } from '@/components/feedback-banner';
import { useApiClient } from '@/lib/use-api-client';
import { useTranslation } from '@/components/providers/i18n-provider';

interface PaginatedResponse<T> {
  data: T[];
  pagination: { limit: number; hasMore: boolean; nextCursor: string | null };
}

const EMPTY_FILTERS: RiskFeedFilters = {
  level: '',
  owner: '',
  createdAfter: '',
  createdBefore: '',
};

export function DashboardContent() {
  const { apiFetch, ready } = useApiClient();
  const { t } = useTranslation();
  const membership = useActiveMembership();
  const isContributor = membership?.role === 'contributor';
  const [summary, setSummary] = useState<DashboardSummaryData | null>(null);
  const [benchmark, setBenchmark] = useState<PortfolioBenchmarkData | null>(null);
  const [summaryUpdatedAt, setSummaryUpdatedAt] = useState<string | null>(null);
  const [risks, setRisks] = useState<RiskFeedItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [owners, setOwners] = useState<string[]>([]);
  const [filters, setFilters] = useState<RiskFeedFilters>(EMPTY_FILTERS);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [partialWarning, setPartialWarning] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [setupReadiness, setSetupReadiness] = useState<SetupReadiness | null>(null);
  const [syncProgress, setSyncProgress] = useState<{
    recordsProcessed?: number;
    recordsTotal?: number | null;
  } | null>(null);
  const [coreCrmName, setCoreCrmName] = useState('CRM');
  const skipFilterReload = useRef(true);

  const buildRiskQuery = useCallback(
    (cursor?: string | null) => {
      const params = new URLSearchParams({
        limit: '20',
        sort: 'score:desc',
        active_only: 'true',
      });
      if (filters.level) params.set('level', filters.level);
      if (filters.owner) params.set('owner', filters.owner);
      if (filters.createdAfter) params.set('created_after', `${filters.createdAfter}T00:00:00.000Z`);
      if (filters.createdBefore) {
        params.set('created_before', `${filters.createdBefore}T23:59:59.999Z`);
      }
      if (cursor) params.set('cursor', cursor);
      return `/v1/risks?${params.toString()}`;
    },
    [filters],
  );

  const applyRiskResponse = useCallback((riskResponse: PaginatedResponse<RiskFeedItem>, append = false) => {
    setRisks((current) => (append ? [...current, ...riskResponse.data] : riskResponse.data));
    setHasMore(riskResponse.pagination.hasMore);
    setNextCursor(riskResponse.pagination.nextCursor);
  }, []);

  const loadRisks = useCallback(
    async (cursor?: string | null, append = false) => {
      const riskResponse = (await apiFetch<PaginatedResponse<RiskFeedItem>>(
        buildRiskQuery(cursor),
      )) as PaginatedResponse<RiskFeedItem>;
      applyRiskResponse(riskResponse, append);
    },
    [apiFetch, applyRiskResponse, buildRiskQuery],
  );

  const loadDashboard = useCallback(async (options?: { silent?: boolean }) => {
    if (!ready) return;

    if (!options?.silent) {
      setLoading(true);
    }
    setError(null);
    setPartialWarning(null);

    try {
      let isSyncing = false;
      let setupRequired = false;

      try {
        const [coreCrmReadiness, jira, slack] = await Promise.all([
          apiFetch<{
            coreCrmId: string;
            coreCrmName?: string;
            snapshot: {
              connected: boolean;
              status: string;
              lastSyncAt?: string | null;
              mappingComplete?: boolean;
              syncProgress?: { recordsProcessed?: number; recordsTotal?: number | null };
            };
          }>('/v1/integrations/core-crm/readiness'),
          apiFetch<{ connected: boolean; status: string; unlinkedBeaconProjectCount?: number; orphans?: unknown[] }>(
            '/v1/integrations/jira/status',
          ),
          apiFetch<{ connected: boolean; status: string }>('/v1/integrations/slack/status'),
        ]);

        setCoreCrmName(coreCrmReadiness.coreCrmName ?? 'CRM');

        isSyncing =
          coreCrmReadiness.snapshot.status === 'syncing' ||
          jira.status === 'syncing' ||
          slack.status === 'syncing';

        const readiness = evaluateSetupReadiness({
          coreCrmId: coreCrmReadiness.coreCrmId,
          coreCrm: {
            connected: coreCrmReadiness.snapshot.connected,
            status: coreCrmReadiness.snapshot.status,
            mappingComplete: Boolean(coreCrmReadiness.snapshot.mappingComplete),
            lastSyncAt: coreCrmReadiness.snapshot.lastSyncAt ?? null,
            syncProgress: coreCrmReadiness.snapshot.syncProgress ?? null,
          },
          workItems: { connected: jira.connected, status: jira.status },
          engagement: { connected: slack.connected, status: slack.status },
          unlinkedJiraProjectCount: jira.unlinkedBeaconProjectCount ?? 0,
          jiraOrphanProjectCount: jira.orphans?.length ?? 0,
        });

        setSetupReadiness(readiness);
        setupRequired = !readiness.isReadyForCoreIntelligence;
      } catch {
        // Contributors may not access integrations; continue with dashboard data.
      }

      setNeedsSetup(setupRequired);
      setSyncing(isSyncing);

      if (isSyncing) {
        try {
          const coreStatus = (await apiFetch<{
            snapshot?: { syncProgress?: { recordsProcessed?: number; recordsTotal?: number | null } };
          }>('/v1/integrations/core-crm/readiness')) as {
            snapshot?: { syncProgress?: { recordsProcessed?: number; recordsTotal?: number | null } };
          };
          setSyncProgress(coreStatus.snapshot?.syncProgress ?? null);
        } catch {
          setSyncProgress(null);
        }
      } else {
        setSyncProgress(null);
      }

      const [dashboard, riskResponse, benchmarkResponse, projects] = await Promise.all([
        apiFetch<DashboardSummaryData & { lastUpdated: string; cached: boolean }>('/v1/dashboard'),
        isSyncing
          ? Promise.resolve(null)
          : apiFetch<PaginatedResponse<RiskFeedItem>>(buildRiskQuery()).catch(() => null),
        apiFetch<{ benchmark: PortfolioBenchmarkData }>('/v1/benchmarks/portfolio').catch(() => null),
        apiFetch<PaginatedResponse<{ ownerEmail?: string | null }>>(
          '/v1/projects?limit=100&status=active',
        ),
      ]);

      const warnings: string[] = [];
      if (!isSyncing && !riskResponse) {
        warnings.push('The risk feed could not be refreshed — portfolio metrics may still be current.');
      }
      if (!benchmarkResponse) {
        warnings.push('Peer benchmarks are temporarily unavailable.');
      }
      if (warnings.length > 0) {
        setPartialWarning(warnings.join(' '));
      }

      const dashboardData = dashboard as DashboardSummaryData & { lastUpdated: string };
      setSummary(dashboardData);
      setSummaryUpdatedAt(dashboardData.lastUpdated);
      setBenchmark(benchmarkResponse ? benchmarkResponse.benchmark : null);

      const projectsData = projects as PaginatedResponse<{ ownerEmail?: string | null }>;
      const uniqueOwners = [
        ...new Set(
          projectsData.data
            .map((project) => project.ownerEmail?.toLowerCase())
            .filter((email): email is string => Boolean(email)),
        ),
      ].sort();
      setOwners(uniqueOwners);

      if (isSyncing) {
        setRisks([]);
        setHasMore(false);
        setNextCursor(null);
      } else if (riskResponse) {
        applyRiskResponse(riskResponse as PaginatedResponse<RiskFeedItem>);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  }, [apiFetch, applyRiskResponse, buildRiskQuery, ready]);

  const loadMoreRisks = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      await loadRisks(nextCursor, true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more risks');
    } finally {
      setLoadingMore(false);
    }
  }, [loadRisks, loadingMore, nextCursor]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    if (!ready || !syncing) return;
    const interval = setInterval(() => {
      void loadDashboard({ silent: true });
    }, 3000);
    return () => clearInterval(interval);
  }, [loadDashboard, ready, syncing]);

  useEffect(() => {
    if (!ready || loading || syncing) return;
    if (skipFilterReload.current) {
      skipFilterReload.current = false;
      return;
    }
    void loadRisks().catch((err) => {
      setError(err instanceof Error ? err.message : 'Failed to filter risks');
    });
  }, [filters, ready, loading, syncing, loadRisks]);

  const showStaleBanner = useMemo(
    () => summaryUpdatedAt != null && isStaleData(summaryUpdatedAt, 10),
    [summaryUpdatedAt],
  );

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (error && !summary) {
    return (
      <div className="settings-section text-center">
        <p className="font-medium text-destructive">Unable to load dashboard</p>
        <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button type="button" className="btn-primary" onClick={() => void loadDashboard()}>
            Retry
          </button>
          <Link href="/integrations/setup" className="btn-secondary">
            Continue setup
          </Link>
          <Link href="/docs?guide=connect-stack&step=0" className="btn-secondary">
            Setup guide
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-print space-y-8">
      {summary && summaryUpdatedAt ? (
        <DashboardPrintSummary
          summary={summary}
          risks={risks}
          generatedAt={summaryUpdatedAt}
        />
      ) : null}

      {isContributor ? (
        <div className="no-print">
          <ContributorReadOnlyBanner
            context="portfolio risks and project details"
            adminHint="To acknowledge or resolve risks, sign in as an admin or operational lead."
          />
        </div>
      ) : null}

      <div className="no-print space-y-8">
        <GettingStartedChecklist
          setupComplete={setupReadiness?.isReadyForCoreIntelligence ?? false}
          risks={risks}
          atRiskCount={summary?.atRiskProjects ?? 0}
        />
        {needsSetup && setupReadiness && !syncing ? (
          <SetupReadinessBanner readiness={setupReadiness} />
        ) : null}
        {showStaleBanner && summaryUpdatedAt ? (
          <StaleDataBanner lastUpdated={summaryUpdatedAt} showSyncAction={!needsSetup} />
        ) : null}
        {partialWarning ? (
          <FeedbackBanner
            variant="warning"
            message={partialWarning}
            onDismiss={() => setPartialWarning(null)}
          />
        ) : null}
      </div>

      {summary && (!needsSetup || summary.activeProjects > 0) ? (
        <PortfolioMetrics summary={summary} />
      ) : needsSetup ? (
        <PortfolioMetricsSetupHint readiness={setupReadiness} />
      ) : null}

      {benchmark ? <BenchmarkComparisonPanel benchmark={benchmark} /> : null}

      {syncing ? (
        <SyncProgressBanner
          crmName={coreCrmName}
          recordsProcessed={syncProgress?.recordsProcessed}
          recordsTotal={syncProgress?.recordsTotal}
        />
      ) : (
        <section className="space-y-4 scroll-mt-24" aria-labelledby="risk-feed-heading">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="risk-feed-heading" className="text-xl font-semibold">
                  {t('dashboard.riskFeedTitle')}
                </h2>
                {risks.length > 0 ? (
                  <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                    {risks.length}
                    {hasMore ? '+' : ''}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{t('dashboard.riskFeedLead')}</p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-3">
              {!needsSetup ? <ContextualDocsLink /> : null}
              {risks[0]?.projectId ? (
                <Link href={`/projects/${risks[0].projectId}`} className="btn-primary no-print">
                  {topPriorityLabel(risks[0])}
                </Link>
              ) : null}
            </div>
          </div>

          <div className="no-print">
            <DashboardFilters filters={filters} owners={owners} onChange={setFilters} />
          </div>

          {error ? (
            <FeedbackBanner variant="error" message={error} onDismiss={() => setError(null)} />
          ) : null}

          {risks.length === 0 ? (
            <EmptyRiskState variant={needsSetup ? 'setup' : 'healthy'} />
          ) : (
            <div className="space-y-4">
              {risks.map((risk) => (
                <RiskCard key={risk.id} risk={risk} onStatusChange={() => void loadDashboard()} />
              ))}
              {hasMore ? (
                <div className="no-print flex justify-center pt-2">
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={loadingMore}
                    onClick={() => void loadMoreRisks()}
                  >
                    {loadingMore ? t('dashboard.loadingMore') : t('dashboard.loadMore')}
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
