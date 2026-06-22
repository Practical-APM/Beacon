'use client';

import { useFormat } from '@/lib/use-format';
import { buildRevenueDelayedLabel } from '@/lib/portfolio-revenue-label';
import { cn } from '@/lib/utils';

export interface CurrencyBreakdownEntry {
  currency: string;
  totalDelayedArr: number;
  projectCount: number;
}

export interface DashboardSummaryData {
  activeProjects: number;
  atRiskProjects: number;
  totalDelayedArr: number | null;
  currency: string | null;
  multiCurrency?: boolean;
  currencyBreakdown?: CurrencyBreakdownEntry[];
  averageConfidence: number | null;
  averageDaysToGoLive: number | null;
  trendStatus: string;
  trendLabel: string;
  projectsWithUnknownArr: number;
}

interface SecondaryMetricProps {
  label: string;
  value: string;
  footnote?: string;
}

function SecondaryMetric({ label, value, footnote }: SecondaryMetricProps) {
  return (
    <div className="px-5 py-4 sm:px-6">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tracking-tight text-foreground">{value}</p>
      {footnote ? (
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{footnote}</p>
      ) : null}
    </div>
  );
}

export function PortfolioMetrics({ summary }: { summary: DashboardSummaryData }) {
  const { formatCurrency, formatDays } = useFormat();
  const trendIsInsufficient = summary.trendStatus === 'insufficient_history';
  const hasAtRisk = summary.atRiskProjects > 0;
  const revenueLabel = buildRevenueDelayedLabel(summary, formatCurrency);

  return (
    <section aria-label="Portfolio metrics" className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <article
          className={cn(
            'surface-card overflow-hidden p-6 transition-shadow hover:shadow-md',
            hasAtRisk && 'ring-1 ring-destructive/20',
          )}
        >
          <p className="text-sm font-medium text-muted-foreground">At risk</p>
          <p
            className={cn(
              'mt-2 text-4xl font-semibold tracking-tight',
              hasAtRisk ? 'text-destructive' : 'text-foreground',
            )}
          >
            {summary.atRiskProjects}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {hasAtRisk
              ? `of ${summary.activeProjects} active implementation${summary.activeProjects === 1 ? '' : 's'} need attention`
              : 'No projects flagged right now'}
          </p>
        </article>

        <article className="surface-card overflow-hidden p-6 transition-shadow hover:shadow-md">
          <p className="text-sm font-medium text-muted-foreground">Revenue delayed</p>
          <p className="mt-2 text-4xl font-semibold tracking-tight text-foreground">{revenueLabel}</p>
          {summary.multiCurrency ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Totals shown per currency — not converted
            </p>
          ) : summary.projectsWithUnknownArr > 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {summary.projectsWithUnknownArr} project
              {summary.projectsWithUnknownArr === 1 ? '' : 's'} with unknown ARR excluded
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Across at-risk go-lives</p>
          )}
        </article>
      </div>

      <article className="surface-card divide-y divide-border sm:grid sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
        <SecondaryMetric label="Active implementations" value={String(summary.activeProjects)} />
        <SecondaryMetric
          label="Avg. time to go-live"
          value={formatDays(summary.averageDaysToGoLive)}
        />
        <SecondaryMetric
          label="Go-live confidence"
          value={summary.averageConfidence != null ? `${summary.averageConfidence}%` : '—'}
        />
        <SecondaryMetric
          label="Trend"
          value={trendIsInsufficient ? '—' : summary.trendLabel}
          footnote={trendIsInsufficient ? 'Insufficient history' : undefined}
        />
      </article>
    </section>
  );
}
