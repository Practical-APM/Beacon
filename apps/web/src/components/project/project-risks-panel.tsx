'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { EvidenceLink } from '@/components/project/evidence-link';
import { RiskLevelBadge } from '@/components/dashboard/risk-level-badge';
import { useActiveMembership } from '@/components/providers/app-session-provider';
import { groupRisksByCategory } from '@/lib/rule-labels';
import { useFormat } from '@/lib/use-format';
import { cn } from '@/lib/utils';

export interface ProjectRiskItem {
  id: string;
  ruleKey?: string | null;
  level: string;
  status: string;
  reason: string;
  score: number;
  confidence: number;
  predictedDelayDays?: number | null;
  version: number;
  evidence?: Array<{
    source?: string;
    signal?: string;
    description?: string;
    deepLink?: string | null;
    entityId?: string | null;
  }>;
  suggestedAction?: string | null;
  suggestedOwner?: string | null;
  escalationPath?: string | null;
}

const LEVEL_SURFACE: Record<string, string> = {
  critical: 'border-destructive/30 bg-destructive/[0.03]',
  high: 'border-amber-500/30 bg-amber-500/[0.04]',
  medium: 'border-yellow-500/25 bg-yellow-500/[0.03]',
  low: 'border-border',
};

export function ProjectRisksPanel({
  risks,
  arrAmount,
  arrCurrency,
  onUpdateStatus,
}: {
  risks: ProjectRiskItem[];
  arrAmount?: number | null;
  arrCurrency?: string | null;
  onUpdateStatus: (
    riskId: string,
    status: 'acknowledged' | 'snoozed' | 'resolved',
    version: number,
  ) => Promise<void>;
}) {
  const { formatCurrency } = useFormat();
  const membership = useActiveMembership();
  const canManage = membership?.role === 'admin' || membership?.role === 'operational';
  const [pendingId, setPendingId] = useState<string | null>(null);
  const grouped = useMemo(() => groupRisksByCategory(risks), [risks]);

  async function handleStatus(
    riskId: string,
    status: 'acknowledged' | 'snoozed' | 'resolved',
    version: number,
  ) {
    setPendingId(riskId);
    try {
      await onUpdateStatus(riskId, status, version);
    } finally {
      setPendingId(null);
    }
  }

  if (risks.length === 0) {
    return (
      <section className="settings-section text-center">
        <ShieldCheck className="mx-auto h-10 w-10 text-primary" aria-hidden />
        <h2 className="mt-4 text-lg font-semibold">No open risks</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This project has no active risk signals right now. Check the timeline below for recent
          activity, or connect Jira and Slack for deeper signal coverage.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-3 text-sm">
          <Link href="/docs?guide=triage-risk&step=1" className="font-medium text-primary hover:underline">
            How to investigate risks
          </Link>
          <Link href="/integrations/setup" className="font-medium text-primary hover:underline">
            Improve signal coverage
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4 scroll-mt-24" aria-labelledby="project-risks-heading">
      <div>
        <h2 id="project-risks-heading" className="text-xl font-semibold">
          Open risks and actions
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {risks.length} active signal{risks.length === 1 ? '' : 's'} requiring attention.
        </p>
      </div>

      {grouped.map((group) => (
        <div key={group.category} className="space-y-3">
          <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            {group.category}
          </h3>
          {group.risks.map((risk) => (
            <article
              key={risk.id}
              className={cn(
                'rounded-lg border bg-card p-5',
                LEVEL_SURFACE[risk.level] ?? LEVEL_SURFACE.low,
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{risk.reason}</p>
                  <p className="mt-1 text-sm capitalize text-muted-foreground">{risk.status}</p>
                </div>
                <RiskLevelBadge level={risk.level} />
              </div>

              {risk.suggestedAction ? (
                <div className="mt-4 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2.5">
                  <p className="text-xs font-medium uppercase tracking-wide text-primary/80">
                    Do this next
                  </p>
                  <p className="mt-1 font-medium text-primary">{risk.suggestedAction}</p>
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
                    {formatCurrency(arrAmount ?? null, arrCurrency ?? 'USD')}
                  </dd>
                </div>
              </dl>

              {risk.evidence && risk.evidence.length > 0 ? (
                <ul className="mt-4 space-y-2 text-sm">
                  {risk.evidence.map((item, index) => (
                    <li
                      key={`${risk.id}-evidence-${index}`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/30 px-3 py-2"
                    >
                      <span>{item.description ?? item.signal ?? 'Evidence item'}</span>
                      <EvidenceLink item={item} />
                    </li>
                  ))}
                </ul>
              ) : null}

              {canManage && risk.status === 'open' ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={pendingId === risk.id}
                    onClick={() => void handleStatus(risk.id, 'acknowledged', risk.version)}
                    className="btn-primary px-3 py-1.5 text-xs"
                  >
                    Acknowledge
                  </button>
                  <button
                    type="button"
                    disabled={pendingId === risk.id}
                    onClick={() => void handleStatus(risk.id, 'snoozed', risk.version)}
                    className="btn-secondary px-3 py-1.5 text-xs"
                  >
                    Snooze
                  </button>
                </div>
              ) : !canManage && risk.status === 'open' ? (
                <p className="mt-4 text-xs text-muted-foreground">
                  View only — ask an admin or operational lead to acknowledge or snooze.
                </p>
              ) : null}
            </article>
          ))}
        </div>
      ))}
    </section>
  );
}
