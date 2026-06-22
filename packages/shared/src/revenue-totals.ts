export interface ArrProjectRow {
  arrAmount: number | null;
  arrCurrency: string | null;
}

export interface CurrencyBreakdownEntry {
  currency: string;
  totalDelayedArr: number;
  projectCount: number;
}

export interface PortfolioArrTotals {
  totalDelayedArr: number | null;
  currency: string | null;
  multiCurrency: boolean;
  currencyBreakdown: CurrencyBreakdownEntry[];
}

function normalizeCurrency(currency: string | null | undefined): string {
  return (currency?.trim().toUpperCase() || 'USD');
}

/** Sum ARR without silently mixing currencies (EC-017). */
export function computePortfolioArrTotals(rows: ArrProjectRow[]): PortfolioArrTotals {
  const byCurrency = new Map<string, { total: number; count: number }>();

  for (const row of rows) {
    if (row.arrAmount == null) continue;
    const currency = normalizeCurrency(row.arrCurrency);
    const existing = byCurrency.get(currency) ?? { total: 0, count: 0 };
    existing.total += row.arrAmount;
    existing.count += 1;
    byCurrency.set(currency, existing);
  }

  const currencyBreakdown = [...byCurrency.entries()]
    .map(([currency, { total, count }]) => ({
      currency,
      totalDelayedArr: total,
      projectCount: count,
    }))
    .sort((a, b) => b.totalDelayedArr - a.totalDelayedArr);

  if (currencyBreakdown.length === 0) {
    return {
      totalDelayedArr: 0,
      currency: 'USD',
      multiCurrency: false,
      currencyBreakdown: [],
    };
  }

  if (currencyBreakdown.length > 1) {
    return {
      totalDelayedArr: null,
      currency: null,
      multiCurrency: true,
      currencyBreakdown,
    };
  }

  const only = currencyBreakdown[0]!;
  return {
    totalDelayedArr: only.totalDelayedArr,
    currency: only.currency,
    multiCurrency: false,
    currencyBreakdown,
  };
}

export function formatPortfolioRevenueImpact(totals: PortfolioArrTotals): string {
  if (totals.multiCurrency) {
    return totals.currencyBreakdown
      .map((row) =>
        new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: row.currency,
          maximumFractionDigits: 0,
        }).format(row.totalDelayedArr),
      )
      .join(' · ');
  }

  const amount = totals.totalDelayedArr ?? 0;
  const currency = totals.currency ?? 'USD';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}
