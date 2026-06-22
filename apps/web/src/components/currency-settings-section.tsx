'use client';

import { listCurrencyFormatOptions } from '@beacon/shared/currency-format';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppSection } from '@/components/app-section';
import { FeedbackBanner } from '@/components/feedback-banner';
import { useApiClient } from '@/lib/use-api-client';
import { useAppSession } from '@/components/providers/app-session-provider';
import { useTranslation } from '@/components/providers/i18n-provider';

const PREVIEW_AMOUNT = 185000;

export function CurrencySettingsSection() {
  const { apiFetch, ready } = useApiClient();
  const { me, refreshMe } = useAppSession();
  const { t } = useTranslation();
  const [value, setValue] = useState(me?.user.currencyFormatLocale ?? 'en-US');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!ready) return;
    const response = (await apiFetch<{ user: { currencyFormatLocale: string } }>('/v1/me')) as {
      user: { currencyFormatLocale: string };
    };
    setValue(response.user.currencyFormatLocale ?? 'en-US');
  }, [apiFetch, ready]);

  useEffect(() => {
    void load().catch((err) =>
      setError(err instanceof Error ? err.message : 'Failed to load currency preference'),
    );
  }, [load]);

  useEffect(() => {
    if (me?.user.currencyFormatLocale) {
      setValue(me.user.currencyFormatLocale);
    }
  }, [me?.user.currencyFormatLocale]);

  const preview = useMemo(() => {
    try {
      return new Intl.NumberFormat(value, {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      }).format(PREVIEW_AMOUNT);
    } catch {
      return `$${PREVIEW_AMOUNT.toLocaleString()}`;
    }
  }, [value]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      await apiFetch('/v1/me/currency-format', {
        method: 'PATCH',
        body: JSON.stringify({ currencyFormatLocale: value }),
      });
      await refreshMe();
      setMessage(t('settings.currency.saved'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppSection title={t('settings.currency.title')} description={t('settings.currency.description')}>
      <form onSubmit={save} className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex flex-1 flex-col gap-2">
            <span className="form-label">{t('settings.currency.label')}</span>
            <select
              className="form-input"
              value={value}
              onChange={(event) => setValue(event.target.value)}
            >
              {listCurrencyFormatOptions().map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={saving} className="btn-primary sm:shrink-0">
            {saving ? t('common.saving') : t('common.save')}
          </button>
        </div>

        <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Preview</p>
          <p className="mt-1 text-lg font-semibold">{preview}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Example revenue at risk display. Amounts are not converted between currencies.
          </p>
        </div>
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
