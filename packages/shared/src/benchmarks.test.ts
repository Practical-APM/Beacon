import { describe, expect, it } from 'vitest';
import {
  benchmarkPosition,
  buildBenchmarkComparison,
  computePercentiles,
  deltaFromMedianPct,
  metricValueFromSnapshot,
  MIN_BENCHMARK_COHORT_SIZE,
} from './benchmarks.js';

describe('benchmarks', () => {
  it('computes percentiles', () => {
    expect(computePercentiles([10, 20, 30, 40])).toEqual({
      p25: 17.5,
      p50: 25,
      p75: 32.5,
    });
  });

  it('classifies lower-is-better metrics', () => {
    const percentiles = { p25: 10, p50: 20, p75: 30 };
    expect(benchmarkPosition(8, percentiles, 'lower_better')).toBe('better');
    expect(benchmarkPosition(20, percentiles, 'lower_better')).toBe('typical');
    expect(benchmarkPosition(35, percentiles, 'lower_better')).toBe('worse');
  });

  it('derives snapshot metric values', () => {
    const snapshot = {
      activeProjects: 4,
      atRiskProjects: 1,
      openRisks: 6,
      avgRiskScore: 42,
      avgDaysToGoLive: 18,
      atRiskRate: 0.25,
    };

    expect(metricValueFromSnapshot('at_risk_rate', snapshot)).toBe(0.25);
    expect(metricValueFromSnapshot('open_risks_per_project', snapshot)).toBe(1.5);
    expect(deltaFromMedianPct(25, 20)).toBe(25);
  });

  it('marks cohort comparisons insufficient below k-anonymity threshold', () => {
    const view = buildBenchmarkComparison(
      {
        activeProjects: 5,
        atRiskProjects: 2,
        openRisks: 4,
        avgRiskScore: 30,
        avgDaysToGoLive: 21,
        atRiskRate: 0.4,
      },
      [
        { metricKey: 'at_risk_rate', p25: 0.2, p50: 0.3, p75: 0.4 },
        { metricKey: 'avg_risk_score', p25: 20, p50: 30, p75: 40 },
        { metricKey: 'avg_days_to_go_live', p25: 14, p50: 21, p75: 28 },
        { metricKey: 'open_risks_per_project', p25: 0.5, p50: 1, p75: 1.5 },
      ],
      MIN_BENCHMARK_COHORT_SIZE - 1,
    );

    expect(view.insufficientData).toBe(true);
    expect(view.metrics.every((metric) => metric.position === 'unknown')).toBe(true);
  });
});
