import type { RiskLevel } from './constants.js';

export const NOTIFICATION_TYPES = ['daily_digest', 'immediate_alert', 'system'] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_CHANNELS = ['email', 'slack', 'in_app'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_FREQUENCIES = ['daily', 'immediate_only', 'off'] as const;
export type NotificationFrequency = (typeof NOTIFICATION_FREQUENCIES)[number];

export interface TenantNotificationSettings {
  enabled?: boolean;
  digestEnabled?: boolean;
  immediateAlertsEnabled?: boolean;
  orgMinSeverity?: RiskLevel;
}

export interface NotificationPreferences {
  emailEnabled: boolean;
  inAppEnabled: boolean;
  slackEnabled: boolean;
  frequency: NotificationFrequency;
  minSeverity: RiskLevel;
  minConfidence: number;
  digestHourLocal: number;
  unsubscribedTypes: NotificationType[];
  globalSnoozeUntil?: string | null;
  timezone?: string;
}

export const DEFAULT_TENANT_NOTIFICATION_SETTINGS: Required<TenantNotificationSettings> = {
  enabled: true,
  digestEnabled: true,
  immediateAlertsEnabled: true,
  orgMinSeverity: 'high',
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  emailEnabled: true,
  inAppEnabled: true,
  slackEnabled: false,
  frequency: 'daily',
  minSeverity: 'high',
  minConfidence: 60,
  digestHourLocal: 8,
  unsubscribedTypes: [],
};

const LEVEL_RANK: Record<RiskLevel, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export function meetsSeverityThreshold(level: RiskLevel, minimum: RiskLevel): boolean {
  return LEVEL_RANK[level] >= LEVEL_RANK[minimum];
}

export function severityIncreased(
  previousLevel: RiskLevel | null | undefined,
  nextLevel: RiskLevel,
): boolean {
  if (!previousLevel) return true;
  return LEVEL_RANK[nextLevel] > LEVEL_RANK[previousLevel];
}

export function buildDigestSubject(atRiskCount: number): string {
  if (atRiskCount === 1) return '1 Customer Implementation Needs Attention';
  return `${atRiskCount} Customer Implementations Need Attention`;
}

export function buildDigestBody(input: {
  atRiskCount: number;
  totalDelayedArr: number | null;
  currency: string | null;
  multiCurrency?: boolean;
  revenueImpactLabel?: string;
  topRisks: string[];
  dashboardUrl: string;
  unsubscribeUrl: string;
}): { subject: string; text: string; html: string } {
  const subject = buildDigestSubject(input.atRiskCount);
  const riskLines =
    input.topRisks.length > 0
      ? input.topRisks.map((risk) => `• ${risk}`).join('\n')
      : '• No new or escalated risks since your last digest';

  const revenueImpact =
    input.revenueImpactLabel ??
    formatMoney(input.totalDelayedArr ?? 0, input.currency ?? 'USD');

  const text = [
    `Beacon detected ${input.atRiskCount} project${input.atRiskCount === 1 ? '' : 's'} with elevated implementation risk.`,
    '',
    'Potential Revenue Impact:',
    input.multiCurrency
      ? `${revenueImpact} (totals shown per currency — not converted)`
      : revenueImpact,
    '',
    'Top Risks:',
    riskLines,
    '',
    `Review recommendations → ${input.dashboardUrl}`,
    '',
    `Unsubscribe from daily digest → ${input.unsubscribeUrl}`,
  ].join('\n');

  const html = [
    `<p>Beacon detected <strong>${input.atRiskCount}</strong> project(s) with elevated implementation risk.</p>`,
    `<p><strong>Potential Revenue Impact:</strong> ${escapeHtml(revenueImpact)}${
      input.multiCurrency ? ' <em>(per currency — not converted)</em>' : ''
    }</p>`,
    `<p><strong>Top Risks:</strong></p><ul>${input.topRisks.map((risk) => `<li>${escapeHtml(risk)}</li>`).join('')}</ul>`,
    `<p><a href="${input.dashboardUrl}">Review recommendations</a></p>`,
    `<p><a href="${input.unsubscribeUrl}">Unsubscribe from daily digest</a></p>`,
  ].join('');

  return { subject, text, html };
}

function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function localDateKey(timezone: string, date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function localHour(timezone: string, date = new Date()): number {
  const hour = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    hour12: false,
  }).format(date);
  return Number(hour);
}

export type ImmediateAlertEvent = {
  riskId: string;
  projectId: string;
  level: RiskLevel;
  reason: string;
};

/** Daily-frequency users get immediate alerts in-app only; email/slack wait for digest. */
export function resolveImmediateAlertChannels(
  prefs: Pick<NotificationPreferences, 'emailEnabled' | 'inAppEnabled' | 'slackEnabled' | 'frequency'>,
): NotificationChannel[] {
  const channels: NotificationChannel[] = [];
  if (prefs.inAppEnabled) channels.push('in_app');
  if (prefs.frequency === 'immediate_only') {
    if (prefs.emailEnabled) channels.push('email');
    if (prefs.slackEnabled) channels.push('slack');
  }
  return channels;
}

export function buildImmediateAlertDedupeKey(userId: string, events: ImmediateAlertEvent[]): string {
  const riskIds = [...new Set(events.map((event) => event.riskId))].sort().join('+');
  return `immediate:batch:${userId}:${riskIds}`;
}

export function buildBatchedImmediateAlert(events: ImmediateAlertEvent[]): {
  title: string;
  body: string;
  text: string;
} {
  if (events.length === 1) {
    const event = events[0]!;
    const title = `${event.level.toUpperCase()} risk: ${event.reason}`;
    const body = `A ${event.level} implementation risk was detected. Review the project dashboard for recommended actions.`;
    return { title, body, text: body };
  }

  const title = `${events.length} implementation risks need attention`;
  const preview = events
    .slice(0, 5)
    .map((event) => `• [${event.level}] ${event.reason}`)
    .join('\n');
  const body = `${events.length} risks were detected in this evaluation. Review your dashboard for recommended actions.\n\n${preview}`;
  return { title, body, text: body };
}
