'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { RiskLevelBadge } from '@/components/dashboard/risk-level-badge';
import { useActiveMembership } from '@/components/providers/app-session-provider';
import { useFormat } from '@/lib/use-format';
import { useApiClient } from '@/lib/use-api-client';
import { cn } from '@/lib/utils';

export interface RiskFeedItem {
  id: string;
  projectId?: string;
  level: string;
  status?: string;
  version?: number;
  reason: string;
  predictedDelayDays: number | null;
  customerName?: string | null;
  projectName?: string | null;
  arrAmount?: number | null;
  arrCurrency?: string | null;
  suggestedAction?: string | null;
}

const LEVEL_SURFACE: Record<string, string> = {
  critical: 'border-destructive/30 bg-destructive/[0.03] hover:border-destructive/50',
  high: 'border-amber-500/30 bg-amber-500/[0.04] hover:border-amber-500/50',
  medium: 'border-yellow-500/25 bg-yellow-500/[0.03] hover:border-yellow-500/40',
  low: 'hover:border-primary/40',
};

export function RiskCard({
  risk,
  onStatusChange,
}: {
  risk: RiskFeedItem;
  onStatusChange?: () => void;
}) {
  const { formatCurrency } = useFormat();
  const { apiFetch } = useApiClient();
  const membership = useActiveMembership();
  const canManage = membership?.role === 'admin' || membership?.role === 'operational';
  const [pending, setPending] = useState(false);
  const displayName = risk.customerName ?? risk.projectName ?? 'Unknown customer';
  const surfaceClass = LEVEL_SURFACE[risk.level] ?? LEVEL_SURFACE.low;
  const showAcknowledge =
    canManage && risk.status === 'open' && risk.version != null && onStatusChange;

  const acknowledge = useCallback(async () => {
    if (risk.version == null) return;
    setPending(true);
    try {
      await apiFetch(`/v1/risks/${risk.id}`, {
        method: 'PATCH',
        headers: { 'Idempotency-Key': `dashboard-ack-${risk.id}-${Date.now()}` },
        body: JSON.stringify({ status: 'acknowledged', version: risk.version }),
      });
      onStatusChange?.();
    } finally {
      setPending(false);
    }
  }, [apiFetch, onStatusChange, risk.id, risk.version]);

  const body = (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold">{displayName}</h3>
          {risk.projectName && risk.customerName ? (
            <p className="text-sm text-muted-foreground">{risk.projectName}</p>
          ) : null}
        </div>
        <RiskLevelBadge level={risk.level} />
      </div>

      {risk.suggestedAction ? (
        <div className="mt-4 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2.5">
          <p className="text-xs font-medium uppercase tracking-wide text-primary/80">
            Do this next
          </p>
          <p className="mt-1 font-medium leading-relaxed text-primary">{risk.suggestedAction}</p>
        </div>
      ) : null}

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Potential delay</dt>
          <dd className="mt-1 font-medium">
            {risk.predictedDelayDays != null ? `${risk.predictedDelayDays} days` : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Revenue impact</dt>
          <dd className="mt-1 font-medium">
            {formatCurrency(risk.arrAmount ?? null, risk.arrCurrency ?? 'USD')}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-muted-foreground">Why it is flagged</dt>
          <dd className="mt-1 leading-relaxed">{risk.reason}</dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {showAcknowledge ? (
          <button
            type="button"
            disabled={pending}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              void acknowledge();
            }}
            className="btn-secondary no-print px-3 py-1.5 text-xs"
          >
            {pending ? 'Saving…' : 'Mark acknowledged'}
          </button>
        ) : !canManage && risk.status === 'open' ? (
          <p className="text-xs text-muted-foreground">
            View only — ask an admin or operational lead to acknowledge.
          </p>
        ) : null}
        {risk.projectId ? (
          <span className="flex items-center gap-1 text-sm font-medium text-primary">
            Open project
            <ChevronRight className="h-4 w-4" aria-hidden />
          </span>
        ) : null}
      </div>
    </>
  );

  if (risk.projectId) {
    return (
      <Link
        href={`/projects/${risk.projectId}`}
        className={cn(
          'group block surface-card p-5 transition-all hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
          surfaceClass,
        )}
      >
        {body}
      </Link>
    );
  }

  return <article className={cn('surface-card p-5', surfaceClass)}>{body}</article>;
}

/** Label for the highest-priority dashboard CTA — includes customer context when available. */
export function topPriorityLabel(risk: RiskFeedItem): string {
  const name = risk.customerName ?? risk.projectName;
  if (!name) return 'Review top priority';
  return `Review ${name}`;
}
