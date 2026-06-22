import { describe, expect, it } from 'vitest';
import { computeDelayPrediction } from './delay-prediction.js';

const baseInput = {
  targetGoLiveDate: '2026-07-01T00:00:00.000Z',
  projectStatus: 'active',
  highestRiskScore: 60,
  openRiskCount: 2,
  dataComplete: true,
  jiraConnected: true,
  salesforceConnected: true,
  ownerEmail: 'owner@example.com',
  peerDaysToGoLive: { p25: 14, p50: 21, p75: 35 },
  cohortSampleTenants: 4,
  enabled: true,
  now: new Date('2026-06-01T00:00:00.000Z'),
};

describe('delay prediction', () => {
  it('returns disabled status when feature is off', () => {
    const result = computeDelayPrediction({ ...baseInput, enabled: false });
    expect(result.status).toBe('disabled');
  });

  it('computes interval and predicted go-live dates', () => {
    const result = computeDelayPrediction(baseInput);
    expect(result.status).toBe('available');
    expect(result.scheduledDaysToGoLive).toBe(30);
    expect(result.predictedDelayDays).toBeGreaterThan(0);
    expect(result.confidenceInterval).toMatchObject({
      level: 0.8,
      lowDelayDays: expect.any(Number),
      highDelayDays: expect.any(Number),
    });
    expect(result.predictedGoLiveDate?.point).toBeTruthy();
    expect(result.onTimeProbability).toBeGreaterThan(0);
    expect(result.onTimeProbability).toBeLessThanOrEqual(1);
  });

  it('requires target go-live date', () => {
    const result = computeDelayPrediction({ ...baseInput, targetGoLiveDate: null });
    expect(result.status).toBe('insufficient_data');
  });

  it('handles past-due projects', () => {
    const result = computeDelayPrediction({
      ...baseInput,
      targetGoLiveDate: '2026-05-01T00:00:00.000Z',
    });
    expect(result.isPastDue).toBe(true);
    expect(result.predictedDelayDays).toBeGreaterThan(0);
  });
});
