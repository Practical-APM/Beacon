import { AlertTriangle } from 'lucide-react';

export function DependencyCycleBanner({ cycleCount }: { cycleCount: number }) {
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-4 text-sm">
      <div className="flex items-start gap-3">
        <AlertTriangle
          className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300"
          aria-hidden="true"
        />
        <div>
          <p className="font-medium text-amber-950 dark:text-amber-50">
            Circular task dependencies detected
          </p>
          <p className="mt-1 leading-relaxed text-muted-foreground">
            {cycleCount === 1
              ? 'One dependency cycle was found in Jira. Beacon excludes cyclic links from blocker analysis so risk scoring stays stable.'
              : `${cycleCount} dependency cycles were found in Jira. Beacon excludes cyclic links from blocker analysis so risk scoring stays stable.`}
          </p>
        </div>
      </div>
    </div>
  );
}
