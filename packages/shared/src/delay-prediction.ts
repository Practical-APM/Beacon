import { computeDataConfidence } from './risk.js';

export type DelayPredictionStatus = 'available' | 'insufficient_data' | 'disabled';

export interface DelayPredictionInput {
  targetGoLiveDate: string | Date | null;
  projectStatus: string;
  highestRiskScore: number | null;
  openRiskCount: number;
  dataComplete: boolean;
  jiraConnected: boolean;
  salesforceConnected: boolean;
  calendarConnected?: boolean;
  ownerEmail: string | null;
  peerDaysToGoLive?: { p25: number | null; p50: number | null; p75: number | null } | null;
  cohortSampleTenants?: number;
  enabled?: boolean;
  now?: Date;
}

export interface DelayPredictionResult {
  status: DelayPredictionStatus;
  targetGoLiveDate: string | null;
  scheduledDaysToGoLive: number | null;
  isPastDue: boolean;
  predictedDelayDays: number | null;
  confidenceInterval: {
    level: number;
    lowDelayDays: number;
    highDelayDays: number;
  } | null;
  predictedGoLiveDate: {
    point: string;
    low: string;
    high: string;
  } | null;
  onTimeProbability: number | null;
  modelConfidence: number;
  basis: string[];
}

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_INTERVAL_LEVEL = 0.8;

function roundDays(value: number): number {
  return Math.round(value * 10) / 10;
}

function toIsoDate(date: Date): string {
  return date.toISOString();
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

function daysUntil(target: Date, now: Date): number {
  return Math.ceil((target.getTime() - now.getTime()) / DAY_MS);
}

function computeUncertaintySpread(input: DelayPredictionInput): number {
  const peer = input.peerDaysToGoLive;
  if (peer?.p25 != null && peer?.p75 != null) {
    return Math.max(5, roundDays((peer.p75 - peer.p25) / 2));
  }
  if (peer?.p50 != null && peer?.p75 != null) {
    return Math.max(5, roundDays(peer.p75 - peer.p50));
  }
  return 10;
}

function computePredictedDelayDays(input: DelayPredictionInput, scheduledDays: number): number {
  const riskScore = input.highestRiskScore ?? 0;
  const riskFactor = riskScore / 100;

  if (scheduledDays < 0) {
    return roundDays(Math.abs(scheduledDays) + input.openRiskCount * 2 + riskScore * 0.08);
  }

  const scheduleRisk = scheduledDays * riskFactor * 0.35;
  const openRiskPenalty = input.openRiskCount * 2;
  return roundDays(scheduleRisk + openRiskPenalty);
}

export function computeDelayPrediction(input: DelayPredictionInput): DelayPredictionResult {
  const now = input.now ?? new Date();
  const basis: string[] = [];

  if (input.enabled === false) {
    return {
      status: 'disabled',
      targetGoLiveDate: null,
      scheduledDaysToGoLive: null,
      isPastDue: false,
      predictedDelayDays: null,
      confidenceInterval: null,
      predictedGoLiveDate: null,
      onTimeProbability: null,
      modelConfidence: 0,
      basis: ['Delay predictions are disabled for this tenant.'],
    };
  }

  if (!input.targetGoLiveDate || input.projectStatus !== 'active') {
    return {
      status: 'insufficient_data',
      targetGoLiveDate: input.targetGoLiveDate
        ? input.targetGoLiveDate instanceof Date
          ? toIsoDate(input.targetGoLiveDate)
          : input.targetGoLiveDate
        : null,
      scheduledDaysToGoLive: null,
      isPastDue: false,
      predictedDelayDays: null,
      confidenceInterval: null,
      predictedGoLiveDate: null,
      onTimeProbability: null,
      modelConfidence: 0,
      basis: ['Target go-live date is required for delay prediction.'],
    };
  }

  const target =
    input.targetGoLiveDate instanceof Date
      ? input.targetGoLiveDate
      : new Date(input.targetGoLiveDate);
  if (Number.isNaN(target.getTime())) {
    return {
      status: 'insufficient_data',
      targetGoLiveDate: null,
      scheduledDaysToGoLive: null,
      isPastDue: false,
      predictedDelayDays: null,
      confidenceInterval: null,
      predictedGoLiveDate: null,
      onTimeProbability: null,
      modelConfidence: 0,
      basis: ['Target go-live date is invalid.'],
    };
  }

  const scheduledDays = daysUntil(target, now);
  const isPastDue = scheduledDays < 0;
  const predictedDelayDays = computePredictedDelayDays(input, scheduledDays);
  const spread = computeUncertaintySpread(input);
  const lowDelayDays = roundDays(Math.max(0, predictedDelayDays - spread));
  const highDelayDays = roundDays(predictedDelayDays + spread);

  let modelConfidence = computeDataConfidence({
    dataComplete: input.dataComplete,
    jiraConnected: input.jiraConnected,
    salesforceConnected: input.salesforceConnected,
    calendarConnected: input.calendarConnected,
    ownerEmail: input.ownerEmail,
  });

  basis.push('Risk score and open risk count');
  if (input.dataComplete) basis.push('Complete Salesforce go-live and ARR fields');
  if (input.jiraConnected) basis.push('Jira task and milestone signals');
  if (input.salesforceConnected) basis.push('Salesforce opportunity timeline');

  if ((input.cohortSampleTenants ?? 0) >= 3 && input.peerDaysToGoLive?.p50 != null) {
    modelConfidence = Math.min(100, modelConfidence + 10);
    basis.push('Peer benchmark dispersion for go-live timing');
  } else {
    basis.push('Default uncertainty band (insufficient peer baseline)');
  }

  const onTimeProbability =
    scheduledDays > 0
      ? Math.max(0, Math.min(1, roundDays(1 - predictedDelayDays / scheduledDays)))
      : 0;

  return {
    status: 'available',
    targetGoLiveDate: toIsoDate(target),
    scheduledDaysToGoLive: scheduledDays,
    isPastDue,
    predictedDelayDays,
    confidenceInterval: {
      level: DEFAULT_INTERVAL_LEVEL,
      lowDelayDays,
      highDelayDays,
    },
    predictedGoLiveDate: {
      point: toIsoDate(addDays(target, predictedDelayDays)),
      low: toIsoDate(addDays(target, lowDelayDays)),
      high: toIsoDate(addDays(target, highDelayDays)),
    },
    onTimeProbability,
    modelConfidence,
    basis,
  };
}
