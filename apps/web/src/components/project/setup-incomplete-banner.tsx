import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';

export function SetupIncompleteBanner() {
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-4 text-sm">
      <div className="flex items-start gap-3">
        <AlertTriangle
          className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300"
          aria-hidden="true"
        />
        <div>
          <p className="font-medium text-amber-950 dark:text-amber-50">
            Missing CRM fields for this project
          </p>
          <p className="mt-1 leading-relaxed text-muted-foreground">
            Beacon needs both ARR and a target go-live date from your CRM to score revenue impact and
            delivery risk accurately. Update the opportunity in Salesforce (or your connected CRM) and
            run a sync, or map the correct fields in integrations.
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Link href="/integrations" className="text-sm font-medium text-primary hover:underline">
              Review CRM field mappings
            </Link>
            <Link href="/docs?guide=connect-stack&step=1" className="text-sm font-medium text-primary hover:underline">
              Mapping guide
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
