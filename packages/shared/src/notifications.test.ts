import { describe, expect, it } from 'vitest';
import {
  buildDigestBody,
  buildDigestSubject,
  buildBatchedImmediateAlert,
  resolveImmediateAlertChannels,
  meetsSeverityThreshold,
  severityIncreased,
} from './notifications.js';

describe('notifications helpers', () => {
  it('checks severity thresholds', () => {
    expect(meetsSeverityThreshold('critical', 'high')).toBe(true);
    expect(meetsSeverityThreshold('medium', 'high')).toBe(false);
  });

  it('detects severity increases', () => {
    expect(severityIncreased('medium', 'high')).toBe(true);
    expect(severityIncreased('high', 'high')).toBe(false);
  });

  it('builds digest copy', () => {
    expect(buildDigestSubject(3)).toBe('3 Customer Implementations Need Attention');
    const body = buildDigestBody({
      atRiskCount: 3,
      totalDelayedArr: 185000,
      currency: 'USD',
      topRisks: ['Security review delays'],
      dashboardUrl: 'https://app.example/dashboard',
      unsubscribeUrl: 'https://app.example/unsubscribe',
    });
    expect(body.text).toContain('$185,000');
    expect(body.text).toContain('Security review delays');
  });

  it('limits immediate email to immediate_only frequency', () => {
    expect(resolveImmediateAlertChannels({
      emailEnabled: true,
      inAppEnabled: true,
      slackEnabled: true,
      frequency: 'daily',
    })).toEqual(['in_app']);

    expect(resolveImmediateAlertChannels({
      emailEnabled: true,
      inAppEnabled: true,
      slackEnabled: false,
      frequency: 'immediate_only',
    })).toEqual(['in_app', 'email']);
  });

  it('batches multiple immediate alerts into one message', () => {
    const alert = buildBatchedImmediateAlert([
      { riskId: 'r1', projectId: 'p1', level: 'high', reason: 'Dependency overdue' },
      { riskId: 'r2', projectId: 'p2', level: 'critical', reason: 'Past due go-live' },
    ]);
    expect(alert.title).toContain('2 implementation risks');
    expect(alert.body).toContain('Dependency overdue');
  });
});
