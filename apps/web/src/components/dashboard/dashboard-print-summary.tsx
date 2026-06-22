'use client';

import { useFormat } from '@/lib/use-format';
import { buildRevenueDelayedLabel } from '@/lib/portfolio-revenue-label';
import type { DashboardSummaryData } from '@/components/dashboard/portfolio-metrics';
import type { RiskFeedItem } from '@/components/dashboard/risk-card';

type DashboardPrintSummaryProps = {
  summary: DashboardSummaryData;
  risks: RiskFeedItem[];
  generatedAt: string;
};

export function DashboardPrintSummary({ summary, risks, generatedAt }: DashboardPrintSummaryProps) {
  const { formatCurrency } = useFormat();
  const topRisks = risks.slice(0, 8);
  const revenueLabel = buildRevenueDelayedLabel(summary, formatCurrency);

  return (
    <div className="print-only mb-8 border-b border-black/20 pb-6">
      <p className="text-xs uppercase tracking-wide text-black/60">Beacon · Executive summary</p>
      <h1 className="mt-1 text-2xl font-semibold text-black">Portfolio risk snapshot</h1>
      <p className="mt-1 text-sm text-black/70">
        Generated {new Date(generatedAt).toLocaleString()}
      </p>

      <dl className="mt-6 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-black/60">At risk</dt>
          <dd className="text-xl font-semibold text-black">{summary.atRiskProjects}</dd>
        </div>
        <div>
          <dt className="text-black/60">Revenue delayed</dt>
          <dd className="text-xl font-semibold text-black">{revenueLabel}</dd>
        </div>
        <div>
          <dt className="text-black/60">Active implementations</dt>
          <dd className="text-xl font-semibold text-black">{summary.activeProjects}</dd>
        </div>
        <div>
          <dt className="text-black/60">Trend</dt>
          <dd className="text-xl font-semibold text-black">
            {summary.trendStatus === 'insufficient_history' ? '—' : summary.trendLabel}
          </dd>
        </div>
      </dl>

      {topRisks.length > 0 ? (
        <div className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-black/70">
            Priority risks
          </h2>
          <table className="mt-3 w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-black/20 text-xs uppercase tracking-wide text-black/60">
                <th className="py-2 pr-3 font-medium">Customer</th>
                <th className="py-2 pr-3 font-medium">Level</th>
                <th className="py-2 pr-3 font-medium">Delay</th>
                <th className="py-2 pr-3 font-medium">Revenue</th>
                <th className="py-2 font-medium">Why flagged</th>
              </tr>
            </thead>
            <tbody>
              {topRisks.map((risk) => (
                <tr key={risk.id} className="border-b border-black/10">
                  <td className="py-2 pr-3 font-medium">
                    {risk.customerName ?? risk.projectName ?? '—'}
                  </td>
                  <td className="py-2 pr-3 capitalize">{risk.level}</td>
                  <td className="py-2 pr-3">
                    {risk.predictedDelayDays != null ? `${risk.predictedDelayDays}d` : '—'}
                  </td>
                  <td className="py-2 pr-3">
                    {formatCurrency(risk.arrAmount ?? null, risk.arrCurrency ?? summary.currency ?? 'USD')}
                  </td>
                  <td className="py-2">{risk.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
