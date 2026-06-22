'use client';

import { useTranslation } from '@/components/providers/i18n-provider';
import { AppPageHeader } from '@/components/app-page-header';
import { ContextualDocsLink } from '@/components/contextual-docs-link';

export function SettingsPageHeader() {
  const { t } = useTranslation();
  return (
    <AppPageHeader title={t('settings.title')} description={t('settings.subtitle')}>
      <ContextualDocsLink />
    </AppPageHeader>
  );
}
