'use client';

import Link from 'next/link';
import { Check, Circle } from 'lucide-react';
import type { SetupReadiness } from '@/lib/setup-readiness';

export function SetupReadinessChecklist({ readiness }: { readiness: SetupReadiness }) {
  if (readiness.isFullyConnected && readiness.isReadyForCoreIntelligence) {
    return (
      <section className="settings-section border-emerald-500/25 bg-emerald-500/5">
        <p className="font-medium text-emerald-900 dark:text-emerald-100">
          Setup complete. Beacon has full signal coverage across your connected tools.
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Return to the{' '}
          <Link href="/dashboard" className="text-primary hover:underline">
            dashboard
          </Link>{' '}
          to review portfolio risk.
        </p>
      </section>
    );
  }

  const totalRequired = 2;
  const requiredRemaining = readiness.blockers.filter((b) => b.required).length;
  const requiredDone = Math.max(0, totalRequired - requiredRemaining);

  return (
    <section className="settings-section overflow-hidden p-0">
      <div className="border-b border-border px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Setup progress</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {readiness.isReadyForCoreIntelligence
                ? 'Core setup is done. Optional connections improve signal quality.'
                : `${requiredDone} of ${totalRequired} required steps done before risk scoring runs.`}
            </p>
          </div>
          <Link
            href="/docs?guide=connect-stack&step=0"
            className="text-xs font-medium text-primary hover:underline"
          >
            View setup walkthrough
          </Link>
        </div>
        {readiness.syncInProgress && readiness.syncProgress ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Syncing: {readiness.syncProgress.recordsProcessed ?? 0}
            {readiness.syncProgress.recordsTotal != null
              ? ` / ${readiness.syncProgress.recordsTotal} records`
              : ' records processed'}
          </p>
        ) : null}
      </div>
      <ol className="divide-y divide-border">
        {readiness.blockers.map((blocker) => (
          <li key={blocker.id}>
            <div className="flex items-start gap-4 px-5 py-4 sm:px-6">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-background text-muted-foreground">
                <Circle className="h-3.5 w-3.5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground">
                  {blocker.label}
                  {!blocker.required ? (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">Optional</span>
                  ) : null}
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">{blocker.why}</p>
              </div>
              <Link href={blocker.fixHref} className="btn-secondary shrink-0 px-3 py-1.5 text-xs">
                {blocker.fixLabel}
              </Link>
            </div>
          </li>
        ))}
        {readiness.isReadyForCoreIntelligence ? (
          <li className="flex items-center gap-4 bg-emerald-500/5 px-5 py-4 sm:px-6">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-700">
              <Check className="h-4 w-4" aria-hidden />
            </span>
            <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100">
              Ready for risk scoring
            </p>
          </li>
        ) : null}
      </ol>
    </section>
  );
}
