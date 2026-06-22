'use client';

import Link from 'next/link';
import { CheckCircle2, Sparkles } from 'lucide-react';
import { useTranslation } from '@/components/providers/i18n-provider';

export function EmptyRiskState({ variant = 'healthy' }: { variant?: 'setup' | 'healthy' }) {
  const { t } = useTranslation();

  if (variant === 'setup') {
    return (
      <div className="settings-section px-6 py-12 text-center">
        <Sparkles className="mx-auto h-10 w-10 text-primary" aria-hidden="true" />
        <h3 className="mt-4 text-xl font-semibold">Risk feed unlocks after setup</h3>
        <p className="mt-2 text-muted-foreground">
          Connect Salesforce and we will auto-configure mappings, import projects, and start scoring
          implementation risk — no manual field mapping.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link href="/integrations/setup" className="btn-primary inline-flex items-center gap-2">
            <Sparkles className="h-4 w-4" aria-hidden />
            Continue setup
          </Link>
          <Link href="/integrations" className="btn-secondary">
            View connections
          </Link>
          <Link href="/docs?guide=connect-stack&step=0" className="btn-secondary">
            Setup walkthrough
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-section px-6 py-12 text-center">
      <CheckCircle2 className="mx-auto h-10 w-10 text-primary" aria-hidden="true" />
      <h3 className="mt-4 text-xl font-semibold">{t('empty.noRisks.title')}</h3>
      <p className="mt-2 text-muted-foreground">{t('empty.noRisks.subtitle')}</p>
      <p className="mt-1 text-sm text-muted-foreground">{t('empty.noRisks.detail')}</p>
      <p className="mt-4 text-sm text-muted-foreground">
        Risks appear when Beacon detects stalled milestones, response gaps, or other signals across
        your connected tools. Check back after the next sync, or review individual projects from
        Salesforce imports.
      </p>
      <Link
        href="/docs?guide=triage-risk&step=0"
        className="mt-6 inline-flex text-sm font-medium text-primary hover:underline"
      >
        How risk triage works
      </Link>
    </div>
  );
}
