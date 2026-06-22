'use client';

import Link from 'next/link';
import { useTranslation } from '@/components/providers/i18n-provider';
import { useActiveMembership } from '@/components/providers/app-session-provider';
import type { BenchmarkMetricComparison } from '@beacon/shared/benchmarks';
import { BarChart3, Settings } from 'lucide-react';

export interface PortfolioBenchmarkData {
  enabled: boolean;
  participationEnabled: boolean;
  snapshotDate: string | null;
  cohortSampleTenants: number;
  insufficientData: boolean;
  metrics: BenchmarkMetricComparison[];
}

function formatMetricValue(key: string, value: number | null): string {
  if (value == null) return '—';
  if (key === 'at_risk_rate') return `${Math.round(value * 100)}%`;
  return String(Math.round(value * 10) / 10);
}

function positionLabel(position: BenchmarkMetricComparison['position']): string {
  switch (position) {
    case 'better':
      return 'Better than peers';
    case 'worse':
      return 'Needs attention';
    case 'typical':
      return 'Typical';
    default:
      return 'Not enough data';
  }
}

function positionClass(position: BenchmarkMetricComparison['position']): string {
  switch (position) {
    case 'better':
      return 'text-emerald-800 bg-emerald-500/10 border-emerald-500/30 dark:text-emerald-300';
    case 'worse':
      return 'text-amber-900 bg-amber-500/10 border-amber-500/30 dark:text-amber-300';
    case 'typical':
      return 'text-muted-foreground bg-muted/40 border-border';
    default:
      return 'text-muted-foreground bg-muted/40 border-border';
  }
}

function PercentileBar({
  tenantValue,
  p25,
  p50,
  p75,
  metricKey,
}: {
  tenantValue: number | null;
  p25: number | null;
  p50: number | null;
  p75: number | null;
  metricKey: string;
}) {
  if (tenantValue == null || p25 == null || p75 == null || p50 == null) return null;

  const isRate = metricKey === 'at_risk_rate';
  const max = Math.max(p75, tenantValue) * (isRate ? 1 : 1.15);
  const min = Math.min(p25, tenantValue) * (isRate ? 1 : 0.85);
  const range = max - min || 1;
  const toPercent = (v: number) => Math.min(100, Math.max(0, ((v - min) / range) * 100));

  return (
    <div className="mt-4" aria-hidden>
      <div className="relative h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="absolute top-0 h-full rounded-full bg-muted-foreground/15"
          style={{ left: `${toPercent(p25)}%`, width: `${toPercent(p75) - toPercent(p25)}%` }}
        />
        <div
          className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 bg-muted-foreground/40"
          style={{ left: `${toPercent(p50)}%` }}
        />
        <div
          className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-primary shadow-sm"
          style={{ left: `${toPercent(tenantValue)}%` }}
        />
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
        <span>P25</span>
        <span>Median</span>
        <span>P75</span>
      </div>
    </div>
  );
}

export function BenchmarkComparisonPanel({ benchmark }: { benchmark: PortfolioBenchmarkData }) {
  const { t } = useTranslation();
  const membership = useActiveMembership();
  const isAdmin = membership?.role === 'admin';

  if (!benchmark.enabled || !benchmark.participationEnabled) {
    return (
      <section className="settings-section border-dashed">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3">
            <BarChart3 className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
            <div>
              <h2 className="settings-section-title">{t('dashboard.benchmarks.title')}</h2>
              <p className="settings-section-lead">{t('dashboard.benchmarks.optInHint')}</p>
              <Link
                href="/docs#settings"
                className="mt-2 inline-flex text-xs font-medium text-primary hover:underline"
              >
                How benchmarks work
              </Link>
            </div>
          </div>
          {isAdmin ? (
            <Link
              href="/settings?tab=admin"
              className="btn-secondary no-print inline-flex shrink-0 items-center gap-2"
            >
              <Settings className="h-4 w-4" aria-hidden />
              Enable in Settings
            </Link>
          ) : (
            <p className="text-sm text-muted-foreground">
              Ask your workspace admin to enable benchmark participation in Settings.
            </p>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="settings-section" aria-label={t('dashboard.benchmarks.title')}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="settings-section-title">{t('dashboard.benchmarks.title')}</h2>
          <p className="settings-section-lead">{t('dashboard.benchmarks.subtitle')}</p>
          {benchmark.cohortSampleTenants > 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Compared against {benchmark.cohortSampleTenants} anonymized peer
              {benchmark.cohortSampleTenants === 1 ? '' : 's'}
            </p>
          ) : null}
        </div>
        {benchmark.snapshotDate ? (
          <p className="text-xs text-muted-foreground">
            {t('dashboard.benchmarks.snapshotDate')}: {benchmark.snapshotDate}
          </p>
        ) : null}
      </div>

      {benchmark.insufficientData ? (
        <p className="mt-4 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          {t('dashboard.benchmarks.insufficientData')}
        </p>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {benchmark.metrics.map((metric) => (
            <article key={metric.key} className="rounded-xl border border-border p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-medium">{metric.label}</h3>
                  <p className="mt-2 text-2xl font-semibold tracking-tight">
                    {formatMetricValue(metric.key, metric.tenantValue)}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${positionClass(metric.position)}`}
                >
                  {positionLabel(metric.position)}
                </span>
              </div>

              <PercentileBar
                tenantValue={metric.tenantValue}
                p25={metric.p25}
                p50={metric.p50}
                p75={metric.p75}
                metricKey={metric.key}
              />

              <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-3 text-xs">
                <div>
                  <dt className="text-muted-foreground">{t('dashboard.benchmarks.p25')}</dt>
                  <dd className="mt-0.5 font-medium text-foreground">
                    {formatMetricValue(metric.key, metric.p25)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t('dashboard.benchmarks.median')}</dt>
                  <dd className="mt-0.5 font-medium text-foreground">
                    {formatMetricValue(metric.key, metric.p50)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t('dashboard.benchmarks.p75')}</dt>
                  <dd className="mt-0.5 font-medium text-foreground">
                    {formatMetricValue(metric.key, metric.p75)}
                  </dd>
                </div>
              </dl>
              {metric.deltaFromMedianPct != null ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  {metric.deltaFromMedianPct > 0 ? '+' : ''}
                  {metric.deltaFromMedianPct}% {t('dashboard.benchmarks.vsMedian')}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
