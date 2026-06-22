import { describe, expect, it, vi } from 'vitest';
import { mergeRiskSettings } from '@beacon/shared';
import { evaluateAllRules, evaluateProjectInactivity } from './rules.js';
import type { ProjectEvaluationContext } from './context.js';

function buildContext(status: ProjectEvaluationContext['project']['status']): ProjectEvaluationContext {
  const now = new Date('2026-06-15T12:00:00.000Z');
  return {
    project: {
      id: 'project-1',
      tenantId: 'tenant-1',
      customerId: 'customer-1',
      name: 'On Hold Project',
      status,
      targetGoLiveDate: new Date('2026-08-01'),
      arrAmount: 10000,
      arrCurrency: 'USD',
      ownerName: 'Owner',
      ownerEmail: 'owner@example.com',
      externalId: null,
      externalSource: null,
      dataComplete: true,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    },
    customerName: 'Customer',
    milestones: [],
    tasks: [],
    dependencies: [],
    lastActivityAt: new Date('2026-01-01T12:00:00.000Z'),
    jiraConnected: true,
    salesforceConnected: true,
    slackSignals: null,
    calendarSignals: null,
    settings: mergeRiskSettings({}),
  };
}

describe('evaluateAllRules lifecycle guard', () => {
  it('skips all rules for on_hold, completed, and cancelled projects', () => {
    for (const status of ['on_hold', 'completed', 'cancelled'] as const) {
      expect(evaluateAllRules(buildContext(status))).toEqual([]);
    }
  });

  it('evaluates rules for active projects', () => {
    const detected = evaluateAllRules(buildContext('active'));
    expect(detected.some((risk) => risk.ruleKey === 'project_inactivity')).toBe(true);
  });
});

describe('evaluateProjectInactivity business days', () => {
  it('skips evaluation on weekends', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-13T12:00:00.000Z')); // Saturday

    const ctx = buildContext('active');
    ctx.lastActivityAt = new Date('2026-06-01T12:00:00.000Z');
    expect(evaluateProjectInactivity(ctx)).toBeNull();

    vi.useRealTimers();
  });

  it('uses business days so a long weekend does not cross the threshold prematurely', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-15T12:00:00.000Z')); // Monday

    const ctx = buildContext('active');
    ctx.settings = mergeRiskSettings({
      timezone: 'UTC',
      rules: {
        project_inactivity: {
          enabled: true,
          level: 'high',
          baseScore: 70,
          thresholdBusinessDays: 3,
        },
      },
    });
    ctx.lastActivityAt = new Date('2026-06-11T15:00:00.000Z'); // Thursday
    ctx.project.updatedAt = ctx.lastActivityAt;

    expect(evaluateProjectInactivity(ctx)).toBeNull();

    vi.useRealTimers();
  });
});
