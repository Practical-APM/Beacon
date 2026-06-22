import type { CurrencyBreakdownEntry } from '@beacon/shared';

export interface RevenueSummaryLike {
  totalDelayedArr: number | null;
  currency: string | null;
  multiCurrency?: boolean;
  currencyBreakdown?: CurrencyBreakdownEntry[];
}

export function buildRevenueDelayedLabel(
  summary: RevenueSummaryLike,
  formatCurrency: (amount: number | null | undefined, currency?: string) => string,
): string {
  if (summary.multiCurrency) {
    return (summary.currencyBreakdown ?? [])
      .map((row) => formatCurrency(row.totalDelayedArr, row.currency))
      .join(' · ');
  }
  return formatCurrency(summary.totalDelayedArr, summary.currency ?? 'USD');
}
