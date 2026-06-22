'use client';

import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

export interface DelayPredictionData {
  status: 'available' | 'insufficient_data' | 'disabled';
  targetGoLiveDate: string | null;
  scheduledDaysToGoLive: number | null;
  isPastDue: boolean;
  predictedDelayDays: number | null;
  confidenceInterval: {
    level: number;
    lowDelayDays: number;
    highDelayDays: number;
  } | null;
  predictedGoLiveDate: {
    point: string;
    low: string;
    high: string;
  } | null;
  onTimeProbability: number | null;
  modelConfidence: number;
  basis: string[];
}

function formatDays(value: number | null): string {
  if (value == null) return '—';
  const rounded = Math.round(value * 10) / 10;
  return `${rounded} day${rounded === 1 ? '' : 's'}`;
}

export function DelayPredictionPanel({ prediction }: { prediction: DelayPredictionData }) {
  if (prediction.status === 'disabled') {
    return (
      <section className="settings-section border-dashed scroll-mt-24">
        <h2 className="settings-section-title">Predicted delay</h2>
        <p className="settings-section-lead">
          Delay predictions are disabled for this organization.{' '}
          <a href="/settings?tab=admin" className="font-medium text-primary hover:underline">
            Enable in admin settings
          </a>{' '}
          to show slip estimates on project pages.
        </p>
      </section>
    );
  }

  if (prediction.status === 'insufficient_data') {
    return (
      <section className="settings-section scroll-mt-24">
        <h2 className="settings-section-title">Predicted delay</h2>
        <p className="settings-section-lead">
          Add a target go-live date in Salesforce and ensure it maps to Beacon.{' '}
          <a href="/integrations#salesforce-mappings" className="font-medium text-primary hover:underline">
            Check field mappings
          </a>{' '}
          if the date is missing after sync.
        </p>
      </section>
    );
  }

  const onTimePercent =
    prediction.onTimeProbability != null ? Math.round(prediction.onTimeProbability * 100) : null;
  const isLikelyLate = onTimePercent != null && onTimePercent < 50;

  return (
    <section className="settings-section scroll-mt-24" aria-label="Predicted delay">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="settings-section-title">Predicted delay</h2>
          <p className="settings-section-lead">
            Estimated slip beyond the target go-live with an 80% confidence interval.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Model confidence: {prediction.modelConfidence}%
        </p>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <div
          className={cn(
            'rounded-xl border p-5',
            isLikelyLate
              ? 'border-destructive/30 bg-destructive/[0.04]'
              : 'border-border bg-muted/20',
          )}
        >
          <p className="text-sm font-medium text-muted-foreground">Best estimate</p>
          <p
            className={cn(
              'mt-1 text-3xl font-semibold tracking-tight',
              isLikelyLate ? 'text-destructive' : 'text-foreground',
            )}
          >
            {formatDays(prediction.predictedDelayDays)}
          </p>
          {onTimePercent != null ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {onTimePercent}% on-time probability
            </p>
          ) : null}
        </div>

        {prediction.confidenceInterval && prediction.predictedGoLiveDate ? (
          <div className="rounded-xl border border-border bg-muted/10 p-5">
            <p className="text-sm font-medium">Predicted go-live range</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {formatDate(prediction.predictedGoLiveDate.low)} –{' '}
              {formatDate(prediction.predictedGoLiveDate.high)}
            </p>
            <p className="mt-2 text-sm">
              Point estimate:{' '}
              <span className="font-medium">{formatDate(prediction.predictedGoLiveDate.point)}</span>
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              Delay interval: {formatDays(prediction.confidenceInterval.lowDelayDays)} to{' '}
              {formatDays(prediction.confidenceInterval.highDelayDays)} (
              {Math.round(prediction.confidenceInterval.level * 100)}% CI)
            </p>
          </div>
        ) : null}
      </div>

      <dl className="mt-6 grid gap-4 border-t border-border pt-6 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">Target go-live</dt>
          <dd className="mt-1 font-medium">{formatDate(prediction.targetGoLiveDate)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Days to target</dt>
          <dd className="mt-1 font-medium">
            {prediction.isPastDue ? (
              <span className="text-destructive">Past due</span>
            ) : (
              formatDays(prediction.scheduledDaysToGoLive)
            )}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">On-time probability</dt>
          <dd className="mt-1 font-medium">
            {onTimePercent != null ? `${onTimePercent}%` : '—'}
          </dd>
        </div>
      </dl>

      {prediction.basis.length > 0 ? (
        <details className="mt-4">
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
            What influenced this prediction ({prediction.basis.length} signals)
          </summary>
          <ul className="mt-2 space-y-1 pl-4 text-xs text-muted-foreground">
            {prediction.basis.map((item) => (
              <li key={item} className="list-disc">
                {item}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
