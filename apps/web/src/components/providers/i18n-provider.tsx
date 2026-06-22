'use client';

import {
  DEFAULT_LOCALE,
  normalizeLocale,
  translate,
  type MessageKey,
  type SupportedLocale,
} from '@beacon/shared/i18n';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import { useAppSession } from '@/components/providers/app-session-provider';

interface I18nContextValue {
  locale: SupportedLocale;
  t: (key: MessageKey, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue>({
  locale: DEFAULT_LOCALE,
  t: (key) => translate(DEFAULT_LOCALE, key),
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const { me } = useAppSession();
  const locale = normalizeLocale(me?.user.locale);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo(
    () => ({
      locale,
      t: (key: MessageKey, params?: Record<string, string | number>) =>
        translate(locale, key, params),
    }),
    [locale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation() {
  return useContext(I18nContext);
}
