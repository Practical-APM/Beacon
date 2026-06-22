import { describe, expect, it } from 'vitest';
import { computePortfolioArrTotals, formatPortfolioRevenueImpact } from './revenue-totals.js';

describe('computePortfolioArrTotals', () => {
  it('sums ARR within a single currency', () => {
    const totals = computePortfolioArrTotals([
      { arrAmount: 45000, arrCurrency: 'USD' },
      { arrAmount: 12000, arrCurrency: 'usd' },
    ]);

    expect(totals.multiCurrency).toBe(false);
    expect(totals.totalDelayedArr).toBe(57000);
    expect(totals.currency).toBe('USD');
  });

  it('does not silently combine multiple currencies', () => {
    const totals = computePortfolioArrTotals([
      { arrAmount: 45000, arrCurrency: 'USD' },
      { arrAmount: 30000, arrCurrency: 'EUR' },
    ]);

    expect(totals.multiCurrency).toBe(true);
    expect(totals.totalDelayedArr).toBeNull();
    expect(totals.currency).toBeNull();
    expect(totals.currencyBreakdown).toEqual([
      { currency: 'USD', totalDelayedArr: 45000, projectCount: 1 },
      { currency: 'EUR', totalDelayedArr: 30000, projectCount: 1 },
    ]);
  });

  it('formats multi-currency breakdown for display', () => {
    const totals = computePortfolioArrTotals([
      { arrAmount: 1000, arrCurrency: 'USD' },
      { arrAmount: 2000, arrCurrency: 'EUR' },
    ]);

    expect(formatPortfolioRevenueImpact(totals)).toContain('$1,000');
    expect(formatPortfolioRevenueImpact(totals)).toContain('€2,000');
  });
});
