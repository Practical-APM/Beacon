import Link from 'next/link';
import { Loader2 } from 'lucide-react';

export function SyncProgressBanner({
  crmName = 'CRM',
  recordsProcessed,
  recordsTotal,
}: {
  crmName?: string;
  recordsProcessed?: number;
  recordsTotal?: number | null;
}) {
  const progress =
    recordsTotal && recordsTotal > 0
      ? Math.min(100, Math.round(((recordsProcessed ?? 0) / recordsTotal) * 100))
      : null;

  return (
    <div className="settings-section text-center">
      <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" aria-hidden="true" />
      <h3 className="mt-4 text-lg font-semibold">Importing your implementations</h3>
      <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
        Beacon is syncing opportunities from {crmName}. Once complete, projects appear in your
        portfolio and the risk feed starts scoring delays, blockers, and engagement gaps.
      </p>
      {progress != null ? (
        <div className="mx-auto mt-4 max-w-md">
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {recordsProcessed ?? 0} of {recordsTotal} records — this page refreshes automatically
          </p>
        </div>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">This page refreshes automatically</p>
      )}
      <div className="mt-6 flex flex-wrap justify-center gap-3 text-sm">
        <Link href="/integrations/setup" className="btn-secondary">
          View sync status
        </Link>
        <Link href="/docs?guide=connect-stack&step=2" className="font-medium text-primary hover:underline">
          What happens during sync?
        </Link>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Want an email when import finishes?{' '}
        <Link href="/settings?tab=notifications" className="font-medium text-primary hover:underline">
          Enable sync notifications
        </Link>
        .
      </p>
    </div>
  );
}
