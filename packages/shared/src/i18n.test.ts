import { normalizeLocale, translate } from './i18n.js';
import { describe, expect, it } from 'vitest';

describe('i18n', () => {
  it('normalizes locale codes', () => {
    expect(normalizeLocale('es-MX')).toBe('es');
    expect(normalizeLocale('jp')).toBe('en');
  });

  it('translates known keys', () => {
    expect(translate('es', 'nav.dashboard')).toBe('Panel');
    expect(translate('en', 'nav.dashboard')).toBe('Portfolio');
  });
});
