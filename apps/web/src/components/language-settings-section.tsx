'use client';

import { listLocaleOptions } from '@beacon/shared/i18n';
import { useState } from 'react';
import { AppSection } from '@/components/app-section';
import { useAppSession } from '@/components/providers/app-session-provider';
import { useTranslation } from '@/components/providers/i18n-provider';
import { FeedbackBanner } from '@/components/feedback-banner';
import { useApiClient } from '@/lib/use-api-client';

export function LanguageSettingsSection() {
  const { t } = useTranslation();
  const { me, refreshMe } = useAppSession();
  const { apiFetch, ready } = useApiClient();
  const [locale, setLocale] = useState(me?.user.locale ?? 'en');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function saveLocale(event: React.FormEvent) {
    event.preventDefault();
    if (!ready) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      await apiFetch('/v1/me/locale', {
        method: 'PATCH',
        body: JSON.stringify({ locale }),
      });
      await refreshMe();
      setMessage(t('settings.language.saved'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppSection title={t('settings.language.title')} description={t('settings.language.description')}>
      <form onSubmit={saveLocale} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex flex-1 flex-col gap-2">
          <span className="form-label">{t('settings.language.title')}</span>
          <select
            className="form-input"
            value={locale}
            onChange={(event) => setLocale(event.target.value)}
          >
            {listLocaleOptions().map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={saving} className="btn-primary sm:shrink-0">
          {saving ? t('common.saving') : t('common.save')}
        </button>
      </form>
      {message ? (
        <FeedbackBanner variant="success" message={message} onDismiss={() => setMessage(null)} />
      ) : null}
      {error ? (
        <FeedbackBanner variant="error" message={error} onDismiss={() => setError(null)} />
      ) : null}
    </AppSection>
  );
}
