import { describe, expect, it } from 'vitest';
import { formatCurrency, formatRelativeUpdated, isStaleData } from './format';

describe('format helpers', () => {
  it('formats currency without decimals', () => {
    expect(formatCurrency(45000, 'USD')).toMatch(/\$45,000/);
  });

  it('returns Unknown for null amounts', () => {
    expect(formatCurrency(null)).toBe('Unknown');
  });

  it('detects stale data', () => {
    const old = new Date(Date.now() - 15 * 60_000).toISOString();
    expect(isStaleData(old, 10)).toBe(true);
  });

  it('formats relative time', () => {
    const recent = new Date(Date.now() - 2 * 60_000).toISOString();
    expect(formatRelativeUpdated(recent)).toMatch(/min ago/);
  });
});
