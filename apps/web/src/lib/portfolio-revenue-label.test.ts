import { describe, expect, it } from 'vitest';
import { buildRevenueDelayedLabel } from './portfolio-revenue-label';

describe('buildRevenueDelayedLabel', () => {
  const formatCurrency = (amount: number | null | undefined, currency = 'USD') =>
    `${currency}:${amount ?? 'unknown'}`;

  it('formats single-currency totals', () => {
    const label = buildRevenueDelayedLabel(
      { totalDelayedArr: 45000, currency: 'USD', multiCurrency: false },
      formatCurrency,
    );
    expect(label).toBe('USD:45000');
  });

  it('joins per-currency totals when multi-currency', () => {
    const label = buildRevenueDelayedLabel(
      {
        totalDelayedArr: null,
        currency: null,
        multiCurrency: true,
        currencyBreakdown: [
          { currency: 'USD', totalDelayedArr: 45000, projectCount: 1 },
          { currency: 'EUR', totalDelayedArr: 30000, projectCount: 1 },
        ],
      },
      formatCurrency,
    );
    expect(label).toBe('USD:45000 · EUR:30000');
  });
});
