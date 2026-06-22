import { describe, expect, it } from 'vitest';
import {
  formatCurrencyAmount,
  normalizeCurrencyFormatLocale,
} from './currency-format.js';

describe('currency format', () => {
  it('normalizes supported locales', () => {
    expect(normalizeCurrencyFormatLocale('de-DE')).toBe('de-DE');
    expect(normalizeCurrencyFormatLocale('invalid')).toBe('en-US');
  });

  it('formats currency with locale-specific separators', () => {
    expect(formatCurrencyAmount(1234, 'USD', 'en-US')).toContain('1,234');
    expect(formatCurrencyAmount(1234, 'EUR', 'de-DE')).toContain('1.234');
  });
});
