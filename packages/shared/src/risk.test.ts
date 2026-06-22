import { describe, expect, it } from 'vitest';
import {
  aggregateCompositeRisk,
  applyHysteresis,
  businessDaysBetween,
  computeDataConfidence,
  isBusinessDay,
  mergeRiskSettings,
  scoreToLevel,
  validateRiskEvidence,
} from './risk.js';

describe('risk scoring helpers', () => {
  it('maps scores to levels', () => {
    expect(scoreToLevel(95)).toBe('critical');
    expect(scoreToLevel(75)).toBe('high');
    expect(scoreToLevel(50)).toBe('medium');
    expect(scoreToLevel(20)).toBe('low');
  });

  it('applies hysteresis when downgrading severity', () => {
    expect(applyHysteresis('high', 68, 5)).toBe('high');
    expect(applyHysteresis('high', 50, 5)).toBe('medium');
  });

  it('respects tenant-configured hysteresis buffer on downgrade', () => {
    expect(applyHysteresis('high', 57, 10)).toBe('high');
    expect(applyHysteresis('high', 46, 2)).toBe('medium');
  });

  it('aggregates composite risk with primary reason', () => {
    const composite = aggregateCompositeRisk([
      {
        ruleKey: 'project_inactivity',
        reason: 'No activity',
        level: 'high',
        score: 78,
        confidence: 70,
        evidence: [{ source: 'system', signal: 'inactivity', description: '10 days' }],
      },
      {
        ruleKey: 'no_assigned_owner',
        reason: 'Missing owner',
        level: 'high',
        score: 74,
        confidence: 70,
        evidence: [{ source: 'jira', signal: 'unassigned', description: '2 tasks' }],
      },
    ]);

    expect(composite?.primaryReason).toBe('No activity');
    expect(composite?.ruleCount).toBe(2);
    expect(composite?.score).toBeGreaterThan(70);
  });
});

describe('business day helpers', () => {
  it('counts business days between dates', () => {
    const start = new Date('2026-06-08T12:00:00.000Z'); // Monday
    const end = new Date('2026-06-12T12:00:00.000Z'); // Friday
    expect(businessDaysBetween(start, end, 'UTC')).toBe(4);
  });

  it('treats weekends as non-business days', () => {
    expect(isBusinessDay(new Date('2026-06-13T12:00:00.000Z'), 'UTC')).toBe(false);
    expect(isBusinessDay(new Date('2026-06-15T12:00:00.000Z'), 'UTC')).toBe(true);
  });

  it('respects tenant timezone when counting business days', () => {
    const start = new Date('2026-06-08T02:00:00.000Z');
    const end = new Date('2026-06-10T02:00:00.000Z');
    expect(businessDaysBetween(start, end, 'America/New_York')).toBeGreaterThan(0);
  });
});

describe('risk settings and evidence', () => {
  it('merges tenant overrides with defaults', () => {
    const settings = mergeRiskSettings({
      timezone: 'America/Los_Angeles',
      rules: {
        project_inactivity: { enabled: false, level: 'high', baseScore: 78, thresholdBusinessDays: 12 },
      },
    });

    expect(settings.timezone).toBe('America/Los_Angeles');
    expect(settings.rules.project_inactivity.enabled).toBe(false);
    expect(settings.rules.past_due_go_live.enabled).toBe(true);
  });

  it('computes confidence from integration completeness', () => {
    expect(
      computeDataConfidence({
        dataComplete: true,
        jiraConnected: true,
        salesforceConnected: true,
        ownerEmail: 'owner@example.com',
      }),
    ).toBe(100);
  });

  it('requires evidence on risks', () => {
    expect(() => validateRiskEvidence([])).toThrow(/evidence/i);
    const evidence = validateRiskEvidence([
      { source: 'jira', signal: 'blocked', description: 'Dependency overdue' },
    ]);
    expect(evidence[0]?.timestamp).toBeDefined();
  });
});
