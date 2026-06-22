import type { RiskLevel } from './constants.js';

export const RISK_RULE_KEYS = [
  'project_inactivity',
  'critical_dependency_overdue',
  'no_assigned_owner',
  'customer_response_delay',
  'milestone_behind_schedule',
  'past_due_go_live',
] as const;

export type RiskRuleKey = (typeof RISK_RULE_KEYS)[number];

export interface RiskEvidence {
  source: 'jira' | 'salesforce' | 'slack' | 'google_calendar' | 'system' | 'graph';
  signal: string;
  description: string;
  timestamp?: string;
  deepLink?: string;
  days?: number;
  entityId?: string;
}

export interface RiskRuleConfig {
  enabled: boolean;
  level: RiskLevel;
  baseScore: number;
  thresholdBusinessDays?: number;
}

export interface TenantRiskSettings {
  timezone?: string;
  rules?: Partial<Record<RiskRuleKey, Partial<RiskRuleConfig>>>;
  blackoutPeriods?: Array<{ start: string; end: string; label?: string }>;
  hysteresisBuffer?: number;
  acknowledgedSuppressionDays?: number;
}

export interface DetectedRisk {
  ruleKey: RiskRuleKey;
  reason: string;
  level: RiskLevel;
  score: number;
  confidence: number;
  evidence: RiskEvidence[];
  predictedDelayDays?: number;
}

export interface CompositeRiskScore {
  score: number;
  level: RiskLevel;
  primaryReason: string;
  primaryRuleKey: RiskRuleKey;
  ruleCount: number;
}

export const DEFAULT_RISK_RULES: Record<RiskRuleKey, RiskRuleConfig> = {
  project_inactivity: {
    enabled: true,
    level: 'high',
    baseScore: 78,
    thresholdBusinessDays: 10,
  },
  critical_dependency_overdue: {
    enabled: true,
    level: 'high',
    baseScore: 82,
  },
  no_assigned_owner: {
    enabled: true,
    level: 'high',
    baseScore: 74,
  },
  customer_response_delay: {
    enabled: true,
    level: 'medium',
    baseScore: 58,
    thresholdBusinessDays: 14,
  },
  milestone_behind_schedule: {
    enabled: true,
    level: 'medium',
    baseScore: 55,
  },
  past_due_go_live: {
    enabled: true,
    level: 'high',
    baseScore: 88,
  },
};

export const LEVEL_SCORE_THRESHOLDS: Record<RiskLevel, number> = {
  critical: 90,
  high: 70,
  medium: 45,
  low: 0,
};

export const SUPPRESSION_LABELS = [
  'waiting_on_customer',
  'on_hold',
  'waiting-on-customer',
  'customer-wait',
] as const;

export function mergeRiskSettings(
  tenantSettings?: TenantRiskSettings | null,
): Required<Pick<TenantRiskSettings, 'timezone' | 'hysteresisBuffer' | 'acknowledgedSuppressionDays'>> & {
  rules: Record<RiskRuleKey, RiskRuleConfig>;
  blackoutPeriods: NonNullable<TenantRiskSettings['blackoutPeriods']>;
} {
  return {
    timezone: tenantSettings?.timezone ?? 'UTC',
    hysteresisBuffer: tenantSettings?.hysteresisBuffer ?? 5,
    acknowledgedSuppressionDays: tenantSettings?.acknowledgedSuppressionDays ?? 7,
    blackoutPeriods: tenantSettings?.blackoutPeriods ?? [],
    rules: RISK_RULE_KEYS.reduce(
      (acc, key) => {
        acc[key] = {
          ...DEFAULT_RISK_RULES[key],
          ...(tenantSettings?.rules?.[key] ?? {}),
        };
        return acc;
      },
      {} as Record<RiskRuleKey, RiskRuleConfig>,
    ),
  };
}

export function scoreToLevel(score: number): RiskLevel {
  if (score >= LEVEL_SCORE_THRESHOLDS.critical) return 'critical';
  if (score >= LEVEL_SCORE_THRESHOLDS.high) return 'high';
  if (score >= LEVEL_SCORE_THRESHOLDS.medium) return 'medium';
  return 'low';
}

export function applyHysteresis(
  currentLevel: RiskLevel,
  nextScore: number,
  buffer = 5,
): RiskLevel {
  const nextLevel = scoreToLevel(nextScore);
  const levelOrder: RiskLevel[] = ['low', 'medium', 'high', 'critical'];
  const currentIdx = levelOrder.indexOf(currentLevel);
  const nextIdx = levelOrder.indexOf(nextLevel);

  if (nextIdx >= currentIdx) {
    return nextLevel;
  }

  const downgradeThreshold =
    LEVEL_SCORE_THRESHOLDS[nextLevel] + (nextLevel === 'low' ? 0 : buffer);
  return nextScore <= downgradeThreshold ? nextLevel : currentLevel;
}

export function aggregateCompositeRisk(detected: DetectedRisk[]): CompositeRiskScore | null {
  if (detected.length === 0) return null;

  const sorted = [...detected].sort((a, b) => b.score - a.score);
  const primary = sorted[0]!;
  const score = Math.min(
    100,
    Math.round(sorted.reduce((sum, item) => sum + item.score, 0) / sorted.length + sorted.length * 2),
  );

  return {
    score,
    level: scoreToLevel(score),
    primaryReason: primary.reason,
    primaryRuleKey: primary.ruleKey,
    ruleCount: detected.length,
  };
}

export function hasSuppressionLabel(labels: string[] | null | undefined): boolean {
  if (!labels?.length) return false;
  const normalized = labels.map((label) => label.trim().toLowerCase());
  return SUPPRESSION_LABELS.some((label) => normalized.includes(label));
}

export function isInBlackoutPeriod(
  date: Date,
  blackoutPeriods: TenantRiskSettings['blackoutPeriods'] = [],
): boolean {
  const ts = date.getTime();
  return (blackoutPeriods ?? []).some((period) => {
    const start = new Date(period.start).getTime();
    const end = new Date(period.end).getTime();
    return ts >= start && ts <= end;
  });
}

function zonedDateParts(date: Date, timezone: string): { year: number; month: number; day: number; weekday: number } {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  });
  const parts = formatter.formatToParts(date);
  const lookup = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return {
    year: Number(lookup.year),
    month: Number(lookup.month),
    day: Number(lookup.day),
    weekday: weekdayMap[lookup.weekday ?? 'Mon'] ?? 1,
  };
}

export function isBusinessDay(date: Date, timezone = 'UTC'): boolean {
  const { weekday } = zonedDateParts(date, timezone);
  return weekday >= 1 && weekday <= 5;
}

export function businessDaysBetween(start: Date, end: Date, timezone = 'UTC'): number {
  if (end.getTime() <= start.getTime()) return 0;

  let count = 0;
  const cursor = new Date(start);
  cursor.setUTCHours(12, 0, 0, 0);

  while (cursor.getTime() < end.getTime()) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (isBusinessDay(cursor, timezone)) {
      count += 1;
    }
  }

  return count;
}

export function computeDataConfidence(input: {
  dataComplete: boolean;
  jiraConnected: boolean;
  salesforceConnected: boolean;
  calendarConnected?: boolean;
  ownerEmail: string | null;
}): number {
  let confidence = 25;
  if (input.dataComplete) confidence += 20;
  if (input.jiraConnected) confidence += 30;
  if (input.salesforceConnected) confidence += 15;
  if (input.calendarConnected) confidence += 5;
  if (input.ownerEmail) confidence += 10;
  return Math.min(100, confidence);
}

export function validateRiskEvidence(evidence: RiskEvidence[]): RiskEvidence[] {
  if (evidence.length === 0) {
    throw new Error('Risk evidence is required');
  }
  return evidence.map((item) => ({
    ...item,
    timestamp: item.timestamp ?? new Date().toISOString(),
  }));
}
