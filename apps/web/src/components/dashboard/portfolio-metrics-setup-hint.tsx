import Link from 'next/link';
import { BarChart3, ArrowRight } from 'lucide-react';
import type { SetupReadiness } from '@/lib/setup-readiness';

export function PortfolioMetricsSetupHint({
  readiness,
}: {
  readiness: SetupReadiness | null;
}) {
  const nextLabel = readiness?.nextBlocker?.fixLabel ?? 'Continue setup';
  const nextHref = readiness?.nextBlocker?.fixHref ?? '/integrations/setup';

  return (
    <section
      aria-label="Portfolio metrics"
      className="settings-section border-dashed bg-muted/20 text-center"
    >
      <BarChart3 className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden />
      <h3 className="mt-4 text-lg font-semibold">Portfolio metrics appear after your first sync</h3>
      <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
        Once Salesforce data is imported, you will see at-risk implementations, delayed ARR, average
        time to go-live, and trend signals here.
      </p>
      <Link href={nextHref} className="btn-primary mt-6 inline-flex items-center gap-2">
        {nextLabel}
        <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
      <p className="mt-4 text-sm text-muted-foreground">
        Need a walkthrough?{' '}
        <Link href="/docs?guide=connect-stack&step=0" className="font-medium text-primary hover:underline">
          Follow the setup guide
        </Link>
      </p>
    </section>
  );
}
