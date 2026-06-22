'use client';

import Link from 'next/link';
import { AlertCircle, ArrowRight, Loader2 } from 'lucide-react';
import type { SetupReadiness } from '@/lib/setup-readiness';
import { cn } from '@/lib/utils';

function syncPercent(processed?: number, total?: number | null): number | null {
  if (total == null || total <= 0 || processed == null) return null;
  return Math.min(100, Math.round((processed / total) * 100));
}

export function SetupReadinessBanner({
  readiness,
  compact = false,
}: {
  readiness: SetupReadiness;
  compact?: boolean;
}) {
  const { nextBlocker, blockers, syncInProgress, syncProgress } = readiness;
  if (!nextBlocker) return null;

  const optionalRemaining = blockers.filter((blocker) => !blocker.required).length;
  const progress = syncPercent(syncProgress?.recordsProcessed, syncProgress?.recordsTotal);
  const isSyncBlocker = nextBlocker.id.endsWith('-sync-running');

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border p-5 sm:p-6',
        isSyncBlocker || syncInProgress
          ? 'border-primary/30 bg-primary/5'
          : 'border-amber-500/30 bg-amber-500/5',
      )}
    >
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-4">
          <div
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
              isSyncBlocker || syncInProgress
                ? 'bg-primary/15 text-primary'
                : 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
            )}
          >
            {isSyncBlocker || syncInProgress ? (
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            ) : (
              <AlertCircle className="h-5 w-5" aria-hidden />
            )}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-foreground">{nextBlocker.label}</p>
            <p className="mt-1 text-sm text-muted-foreground">{nextBlocker.why}</p>

            {(isSyncBlocker || syncInProgress) && progress != null ? (
              <div className="mt-3 max-w-md space-y-2">
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {syncProgress?.recordsProcessed ?? 0}
                  {syncProgress?.recordsTotal ? ` / ${syncProgress.recordsTotal}` : ''} records
                  processed
                </p>
              </div>
            ) : null}

            {!compact && optionalRemaining > 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">
                {optionalRemaining} optional connection{optionalRemaining === 1 ? '' : 's'} remain
                for full signal coverage (Jira, Slack).
              </p>
            ) : null}
          </div>
        </div>
        {!isSyncBlocker ? (
          <div className="flex flex-wrap gap-2 sm:shrink-0">
            <Link href={nextBlocker.fixHref} className="btn-primary inline-flex items-center gap-2">
              {nextBlocker.fixLabel}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            {!compact ? (
              <>
                <Link href="/integrations/setup" className="btn-secondary">
                  Continue setup
                </Link>
                <Link href="/docs?guide=connect-stack&step=0" className="btn-secondary">
                  Setup guide
                </Link>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
