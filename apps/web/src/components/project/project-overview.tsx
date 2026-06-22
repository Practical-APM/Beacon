import { useFormat } from '@/lib/use-format';
import { formatDaysUntil, daysUntil } from '@/lib/format';
import { RiskLevelBadge } from '@/components/dashboard/risk-level-badge';
import { cn } from '@/lib/utils';

export interface ProjectOverviewData {
  project: {
    id: string;
    name: string;
    status: string;
    targetGoLiveDate?: string | null;
    arrAmount?: number | null;
    arrCurrency?: string | null;
    ownerName?: string | null;
    ownerEmail?: string | null;
  };
  customer?: { name: string } | null;
  health: {
    openRiskCount: number;
    highestRiskLevel: string | null;
    highestRiskScore: number | null;
    averageConfidence: number | null;
  };
}

export function ProjectOverview({
  data,
  hasOpenRisks,
}: {
  data: ProjectOverviewData;
  hasOpenRisks?: boolean;
}) {
  const { project, customer, health } = data;
  const { formatCurrency, formatDate } = useFormat();
  const daysLeft = daysUntil(project.targetGoLiveDate);
  const pastDue = daysLeft != null && daysLeft < 0;
  const ownerDisplay = project.ownerName ?? project.ownerEmail ?? null;

  return (
    <section className="settings-section scroll-mt-24">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{customer?.name ?? 'Customer'}</p>
          <h2 className="mt-1 text-2xl font-semibold">{project.name}</h2>
          {ownerDisplay ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Owner:{' '}
              {project.ownerEmail ? (
                <a
                  href={`mailto:${project.ownerEmail}`}
                  className="font-medium text-primary hover:underline"
                >
                  {ownerDisplay}
                </a>
              ) : (
                ownerDisplay
              )}
            </p>
          ) : (
            <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">
              No owner assigned. Risk signals may lack an escalation contact.
            </p>
          )}
        </div>
        {health.highestRiskLevel ? <RiskLevelBadge level={health.highestRiskLevel} /> : null}
      </div>

      <dl className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Revenue at stake
          </dt>
          <dd className="mt-1 text-2xl font-semibold tracking-tight">
            {formatCurrency(project.arrAmount ?? null, project.arrCurrency ?? 'USD')}
          </dd>
        </div>
        <div
          className={cn(
            'rounded-lg border p-4',
            pastDue ? 'border-destructive/30 bg-destructive/[0.04]' : 'border-border bg-muted/20',
          )}
        >
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Target go-live
          </dt>
          <dd className="mt-1 text-lg font-semibold">{formatDate(project.targetGoLiveDate)}</dd>
          <dd
            className={cn(
              'mt-0.5 text-sm',
              pastDue ? 'font-medium text-destructive' : 'text-muted-foreground',
            )}
          >
            {formatDaysUntil(project.targetGoLiveDate)}
          </dd>
        </div>
        <div
          className={cn(
            'rounded-lg border p-4',
            health.openRiskCount > 0
              ? 'border-destructive/25 bg-destructive/[0.03]'
              : 'border-border bg-muted/20',
          )}
        >
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Open risks
          </dt>
          <dd
            className={cn(
              'mt-1 text-2xl font-semibold',
              health.openRiskCount > 0 && 'text-destructive',
            )}
          >
            {health.openRiskCount}
          </dd>
          {health.averageConfidence != null ? (
            <dd className="mt-0.5 text-sm text-muted-foreground">
              {health.averageConfidence}% model confidence
            </dd>
          ) : null}
        </div>
      </dl>

      <dl className="mt-4 grid gap-3 border-t border-border pt-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Implementation status</dt>
          <dd className="mt-1 capitalize">{project.status.replace(/_/g, ' ')}</dd>
        </div>
        {health.openRiskCount > 0 && health.highestRiskScore != null ? (
          <div>
            <dt className="text-muted-foreground">Highest risk score</dt>
            <dd className="mt-1 font-medium">{health.highestRiskScore}</dd>
          </div>
        ) : null}
      </dl>

      {hasOpenRisks ?? health.openRiskCount > 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          <a href="#project-risks" className="font-medium text-primary hover:underline">
            Jump to open risks
          </a>
          {' · '}
          Review predicted delays and suggested actions, then assign follow-up to the owner if needed.
        </p>
      ) : null}
    </section>
  );
}
