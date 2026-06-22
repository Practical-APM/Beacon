export const SUPPORTED_CURRENCY_FORMAT_LOCALES = [
  'en-US',
  'en-GB',
  'de-DE',
  'fr-FR',
  'es-ES',
  'ja-JP',
  'en-IN',
] as const;

export type CurrencyFormatLocale = (typeof SUPPORTED_CURRENCY_FORMAT_LOCALES)[number];

export const DEFAULT_CURRENCY_FORMAT_LOCALE: CurrencyFormatLocale = 'en-US';

export const CURRENCY_FORMAT_LABELS: Record<CurrencyFormatLocale, string> = {
  'en-US': 'US English ($1,234)',
  'en-GB': 'UK English (£1,234)',
  'de-DE': 'German (1.234 €)',
  'fr-FR': 'French (1 234 €)',
  'es-ES': 'Spanish (1.234 €)',
  'ja-JP': 'Japanese (¥1,234)',
  'en-IN': 'Indian English (₹1,234)',
};

export function normalizeCurrencyFormatLocale(
  value: string | null | undefined,
): CurrencyFormatLocale {
  if (!value) return DEFAULT_CURRENCY_FORMAT_LOCALE;
  const normalized = value.trim();
  if ((SUPPORTED_CURRENCY_FORMAT_LOCALES as readonly string[]).includes(normalized)) {
    return normalized as CurrencyFormatLocale;
  }
  return DEFAULT_CURRENCY_FORMAT_LOCALE;
}

export function listCurrencyFormatOptions() {
  return SUPPORTED_CURRENCY_FORMAT_LOCALES.map((id) => ({
    id,
    label: CURRENCY_FORMAT_LABELS[id],
  }));
}

export function formatCurrencyAmount(
  amount: number | null | undefined,
  currency: string,
  locale: CurrencyFormatLocale = DEFAULT_CURRENCY_FORMAT_LOCALE,
): string {
  if (amount == null) return 'Unknown';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}
