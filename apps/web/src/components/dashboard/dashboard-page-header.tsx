'use client';

import { Printer } from 'lucide-react';
import { useTranslation } from '@/components/providers/i18n-provider';
import { AppPageHeader } from '@/components/app-page-header';
import { ContextualDocsLink } from '@/components/contextual-docs-link';

export function DashboardPageHeader() {
  const { t } = useTranslation();
  return (
    <AppPageHeader title={t('dashboard.title')} description={t('dashboard.subtitle')}>
      <ContextualDocsLink />
      <button
        type="button"
        onClick={() => window.print()}
        className="btn-secondary no-print inline-flex items-center gap-2"
        aria-label="Print executive summary"
      >
        <Printer className="h-4 w-4" aria-hidden />
        Print summary
      </button>
    </AppPageHeader>
  );
}
