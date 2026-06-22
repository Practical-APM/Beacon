import Link from 'next/link';
import { Clock3, RefreshCw } from 'lucide-react';
import { formatRelativeUpdated } from '@/lib/format';

export function StaleDataBanner({
  lastUpdated,
  showSyncAction = false,
}: {
  lastUpdated: string;
  showSyncAction?: boolean;
}) {
  return (
    <div
      className="flex flex-col gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
      role="status"
    >
      <div className="flex items-center gap-2 text-amber-950 dark:text-amber-50">
        <Clock3 className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          Last updated {formatRelativeUpdated(lastUpdated)}. Risk scores may not reflect recent
          changes in Salesforce, Jira, or Slack.
        </span>
      </div>
      {showSyncAction ? (
        <div className="flex shrink-0 flex-wrap gap-2 self-start sm:self-auto">
          <Link
            href="/integrations#salesforce"
            className="btn-secondary inline-flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            Run sync
          </Link>
          <Link href="/docs?guide=connect-stack&step=2" className="btn-secondary">
            Sync help
          </Link>
        </div>
      ) : null}
    </div>
  );
}
