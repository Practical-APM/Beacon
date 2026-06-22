import Link from 'next/link';
import { FlaskConical } from 'lucide-react';

export function DevMockIntegrationsBanner() {
  return (
    <div
      className="flex items-start gap-3 rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 text-sm"
      role="status"
    >
      <FlaskConical className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
      <div>
        <p className="font-medium text-foreground">Local demo mode</p>
        <p className="mt-1 leading-relaxed text-muted-foreground">
          Connect buttons use seeded demo data when OAuth credentials are not configured. In
          production, the same actions start real OAuth flows — no separate mock UI.
        </p>
        <Link
          href="/docs?guide=connect-stack&step=0"
          className="mt-2 inline-flex font-medium text-primary hover:underline"
        >
          Setup walkthrough
        </Link>
      </div>
    </div>
  );
}
