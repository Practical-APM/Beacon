import { describe, expect, it } from 'vitest';
import { computePortfolioArrTotals } from '@beacon/shared';
import { rowsToCsv } from './dashboard-service.js';

describe('computePortfolioArrTotals', () => {
  it('matches dashboard revenue aggregation rules', () => {
    const totals = computePortfolioArrTotals([
      { arrAmount: 45000, arrCurrency: 'USD' },
      { arrAmount: 12000, arrCurrency: 'USD' },
    ]);
    expect(totals.totalDelayedArr).toBe(57000);
    expect(totals.multiCurrency).toBe(false);
  });
});

describe('rowsToCsv', () => {
  it('escapes commas and quotes', () => {
    const csv = rowsToCsv(['name', 'note'], [
      { name: 'Acme, Inc', note: 'Says "urgent"' },
    ]);
    expect(csv).toBe('name,note\n"Acme, Inc","Says ""urgent"""\n');
  });
});
