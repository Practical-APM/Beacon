import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PortfolioMetrics } from './portfolio-metrics';

vi.mock('@/lib/use-format', () => ({
  useFormat: () => ({
    formatCurrency: (amount: number | null | undefined) =>
      amount == null ? '—' : `$${amount.toLocaleString('en-US')}`,
    formatDays: (days: number | null | undefined) =>
      days == null ? '—' : `${days} days`,
  }),
}));

describe('PortfolioMetrics', () => {
  it('highlights at-risk projects on the dashboard', () => {
    render(
      <PortfolioMetrics
        summary={{
          activeProjects: 12,
          atRiskProjects: 3,
          totalDelayedArr: 45000,
          currency: 'USD',
          multiCurrency: false,
          averageConfidence: 72,
          averageDaysToGoLive: 18,
          trendStatus: 'stable',
          trendLabel: 'Stable',
          projectsWithUnknownArr: 0,
        }}
      />,
    );

    expect(screen.getByRole('region', { name: 'Portfolio metrics' })).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText(/of 12 active implementations need attention/)).toBeInTheDocument();
    expect(screen.getByText('$45,000')).toBeInTheDocument();
  });

  it('shows healthy state when no projects are at risk', () => {
    render(
      <PortfolioMetrics
        summary={{
          activeProjects: 5,
          atRiskProjects: 0,
          totalDelayedArr: 0,
          currency: 'USD',
          multiCurrency: false,
          averageConfidence: null,
          averageDaysToGoLive: null,
          trendStatus: 'insufficient_history',
          trendLabel: 'Not enough history',
          projectsWithUnknownArr: 0,
        }}
      />,
    );

    expect(screen.getByText('No projects flagged right now')).toBeInTheDocument();
  });
});
