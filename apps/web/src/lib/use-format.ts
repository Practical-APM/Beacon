'use client';

import {
  formatCurrencyAmount,
  normalizeCurrencyFormatLocale,
  type CurrencyFormatLocale,
} from '@beacon/shared/currency-format';
import { useMemo } from 'react';
import { useAppSession } from '@/components/providers/app-session-provider';
import {
  formatDate as formatDateBase,
  formatDays as formatDaysBase,
  formatRelativeUpdated,
  isStaleData,
} from '@/lib/format';

export function useFormat() {
  const { me } = useAppSession();
  const currencyFormatLocale = normalizeCurrencyFormatLocale(
    me?.user.currencyFormatLocale,
  ) as CurrencyFormatLocale;

  return useMemo(
    () => ({
      currencyFormatLocale,
      formatCurrency: (amount: number | null | undefined, currency = 'USD') =>
        formatCurrencyAmount(amount, currency, currencyFormatLocale),
      formatDate: formatDateBase,
      formatDays: formatDaysBase,
      formatRelativeUpdated,
      isStaleData,
    }),
    [currencyFormatLocale],
  );
}
