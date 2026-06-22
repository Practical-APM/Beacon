export const BENCHMARK_COHORT = 'all' as const;

export const BENCHMARK_METRICS = [
  {
    key: 'at_risk_rate',
    label: 'At-risk project rate',
    direction: 'lower_better' as const,
  },
  {
    key: 'avg_risk_score',
    label: 'Average risk score',
    direction: 'lower_better' as const,
  },
  {
    key: 'avg_days_to_go_live',
    label: 'Average days to go-live',
    direction: 'lower_better' as const,
  },
  {
    key: 'open_risks_per_project',
    label: 'Open risks per project',
    direction: 'lower_better' as const,
  },
] as const;

export type BenchmarkMetricKey = (typeof BENCHMARK_METRICS)[number]['key'];
export type BenchmarkDirection = (typeof BENCHMARK_METRICS)[number]['direction'];
export type BenchmarkPosition = 'better' | 'typical' | 'worse' | 'unknown';

export const MIN_BENCHMARK_COHORT_SIZE = 3;

export interface BenchmarkPercentiles {
  p25: number | null;
  p50: number | null;
  p75: number | null;
}

export interface BenchmarkMetricComparison {
  key: BenchmarkMetricKey;
  label: string;
  direction: BenchmarkDirection;
  tenantValue: number | null;
  p25: number | null;
  p50: number | null;
  p75: number | null;
  position: BenchmarkPosition;
  deltaFromMedianPct: number | null;
}

export interface PortfolioBenchmarkView {
  enabled: boolean;
  participationEnabled: boolean;
  snapshotDate: string | null;
  cohortSampleTenants: number;
  insufficientData: boolean;
  metrics: BenchmarkMetricComparison[];
}

function roundMetric(value: number): number {
  return Math.round(value * 100) / 100;
}

export function computePercentiles(values: number[]): BenchmarkPercentiles {
  if (values.length === 0) {
    return { p25: null, p50: null, p75: null };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const percentile = (q: number) => {
    const index = (sorted.length - 1) * q;
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    if (lower === upper) return sorted[lower]!;
    const weight = index - lower;
    return sorted[lower]! + (sorted[upper]! - sorted[lower]!) * weight;
  };

  return {
    p25: roundMetric(percentile(0.25)),
    p50: roundMetric(percentile(0.5)),
    p75: roundMetric(percentile(0.75)),
  };
}

export function benchmarkPosition(
  value: number,
  percentiles: BenchmarkPercentiles,
  direction: BenchmarkDirection,
): BenchmarkPosition {
  const { p25, p50, p75 } = percentiles;
  if (p25 == null || p50 == null || p75 == null) return 'unknown';

  if (direction === 'lower_better') {
    if (value <= p25) return 'better';
    if (value >= p75) return 'worse';
    return 'typical';
  }

  if (value >= p75) return 'better';
  if (value <= p25) return 'worse';
  return 'typical';
}

export function deltaFromMedianPct(value: number, median: number | null): number | null {
  if (median == null || median === 0) return null;
  return roundMetric(((value - median) / Math.abs(median)) * 100);
}

export function metricValueFromSnapshot(
  key: BenchmarkMetricKey,
  snapshot: {
    activeProjects: number;
    atRiskProjects: number;
    openRisks: number;
    avgRiskScore: number | null;
    avgDaysToGoLive: number | null;
    atRiskRate: number | null;
  },
): number | null {
  if (snapshot.activeProjects <= 0) {
    if (key === 'open_risks_per_project' && snapshot.openRisks > 0) {
      return roundMetric(snapshot.openRisks);
    }
    return null;
  }

  switch (key) {
    case 'at_risk_rate':
      return snapshot.atRiskRate ?? roundMetric(snapshot.atRiskProjects / snapshot.activeProjects);
    case 'avg_risk_score':
      return snapshot.avgRiskScore;
    case 'avg_days_to_go_live':
      return snapshot.avgDaysToGoLive;
    case 'open_risks_per_project':
      return roundMetric(snapshot.openRisks / snapshot.activeProjects);
    default:
      return null;
  }
}

export function buildBenchmarkComparison(
  snapshot: {
    activeProjects: number;
    atRiskProjects: number;
    openRisks: number;
    avgRiskScore: number | null;
    avgDaysToGoLive: number | null;
    atRiskRate: number | null;
  },
  cohortRows: Array<{ metricKey: string; p25: number | null; p50: number | null; p75: number | null }>,
  cohortSampleTenants: number,
): PortfolioBenchmarkView {
  const insufficientData = cohortSampleTenants < MIN_BENCHMARK_COHORT_SIZE;
  const cohortByKey = new Map(cohortRows.map((row) => [row.metricKey, row]));

  const metrics = BENCHMARK_METRICS.map((definition) => {
    const tenantValue = metricValueFromSnapshot(definition.key, snapshot);
    const cohort = cohortByKey.get(definition.key);
    const percentiles: BenchmarkPercentiles = {
      p25: cohort?.p25 ?? null,
      p50: cohort?.p50 ?? null,
      p75: cohort?.p75 ?? null,
    };

    const position =
      tenantValue == null || insufficientData
        ? 'unknown'
        : benchmarkPosition(tenantValue, percentiles, definition.direction);

    return {
      key: definition.key,
      label: definition.label,
      direction: definition.direction,
      tenantValue,
      p25: percentiles.p25,
      p50: percentiles.p50,
      p75: percentiles.p75,
      position,
      deltaFromMedianPct:
        tenantValue == null ? null : deltaFromMedianPct(tenantValue, percentiles.p50),
    };
  });

  return {
    enabled: true,
    participationEnabled: true,
    snapshotDate: null,
    cohortSampleTenants,
    insufficientData,
    metrics,
  };
}
