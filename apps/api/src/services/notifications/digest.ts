import {
  notificationPreferences,
  projects,
  risks,
  tenantMemberships,
  users,
  withTenantContext,
  type Database,
} from '@beacon/db';
import type { RiskLevel } from '@beacon/shared/constants';
import {
  localDateKey,
  localHour,
  meetsSeverityThreshold,
  buildDigestBody,
  buildBatchedImmediateAlert,
  buildImmediateAlertDedupeKey,
  resolveImmediateAlertChannels,
  type NotificationChannel,
} from '@beacon/shared/notifications';
import { formatPortfolioRevenueImpact } from '@beacon/shared';
import { and, desc, eq, gte, inArray, isNull, sql } from 'drizzle-orm';
import { env } from '../../env.js';
import { getDashboardSummary } from '../dashboard-service.js';
import type { AuthContext } from '@beacon/shared/auth';
import { deliverChannels } from './delivery.js';
import {
  ensureUnsubscribeToken,
  getOrCreatePreferences,
  getTenantNotificationSettings,
} from './preferences.js';

export interface RiskAlertEvent {
  riskId: string;
  projectId: string;
  level: RiskLevel;
  previousLevel: RiskLevel | null;
  isNew: boolean;
  severityIncreased: boolean;
  confidence: number;
  reason: string;
}

function isSnoozed(globalSnoozeUntil: Date | null | undefined): boolean {
  return Boolean(globalSnoozeUntil && globalSnoozeUntil.getTime() > Date.now());
}

export async function processImmediateAlerts(
  db: Database,
  tenantId: string,
  events: RiskAlertEvent[],
): Promise<void> {
  if (events.length === 0) return;

  const tenantSettings = await getTenantNotificationSettings(db, tenantId);
  if (!tenantSettings.enabled || !tenantSettings.immediateAlertsEnabled) return;

  const memberships = await db
    .select({
      userId: tenantMemberships.userId,
      role: tenantMemberships.role,
      email: users.email,
      timezone: users.timezone,
      emailValid: users.emailValid,
      globalSnoozeUntil: users.globalSnoozeUntil,
    })
    .from(tenantMemberships)
    .innerJoin(users, eq(tenantMemberships.userId, users.id))
    .where(and(eq(tenantMemberships.tenantId, tenantId), isNull(tenantMemberships.deletedAt)));

  for (const member of memberships) {
    if (isSnoozed(member.globalSnoozeUntil)) continue;

    const prefs = await getOrCreatePreferences(db, tenantId, member.userId);
    if (prefs.frequency === 'off') continue;
    if ((prefs.unsubscribedTypes ?? []).includes('immediate_alert')) continue;

    const channels = resolveImmediateAlertChannels(prefs);
    if (channels.length === 0) continue;

    const qualifying = events.filter((event) => {
      if (!event.isNew && !event.severityIncreased) return false;
      if (!meetsSeverityThreshold(event.level, tenantSettings.orgMinSeverity)) return false;
      if (!meetsSeverityThreshold(event.level, prefs.minSeverity as RiskLevel)) return false;
      return event.confidence >= prefs.minConfidence;
    });

    if (qualifying.length === 0) continue;

    const alertEvents = qualifying.map((event) => ({
      riskId: event.riskId,
      projectId: event.projectId,
      level: event.level,
      reason: event.reason,
    }));

    const { title, body, text } = buildBatchedImmediateAlert(alertEvents);
    const dedupeKey = buildImmediateAlertDedupeKey(member.userId, alertEvents);
    const token = await ensureUnsubscribeToken(db, member.userId);
    const dashboardUrl =
      alertEvents.length === 1
        ? `${env.WEB_APP_URL}/projects/${alertEvents[0]!.projectId}`
        : `${env.WEB_APP_URL}/dashboard`;

    await deliverChannels(
      db,
      {
        tenantId,
        userId: member.userId,
        riskId: alertEvents[0]?.riskId,
        channel: 'in_app',
        notificationType: 'immediate_alert',
        dedupeKey,
        toEmail: member.emailValid ? member.email : undefined,
        subject: title,
        text: `${text}\n\n${dashboardUrl}`,
        title,
        body,
        metadata: {
          projectId: alertEvents[0]?.projectId,
          riskIds: alertEvents.map((event) => event.riskId),
          batchedCount: alertEvents.length,
          unsubscribeToken: token,
        },
      },
      channels,
    );
  }
}

export async function runDailyDigests(db: Database): Promise<number> {
  const rows = await db
    .select({
      tenantId: notificationPreferences.tenantId,
      userId: notificationPreferences.userId,
      digestHourLocal: notificationPreferences.digestHourLocal,
      lastDigestSentAt: notificationPreferences.lastDigestSentAt,
      emailEnabled: notificationPreferences.emailEnabled,
      inAppEnabled: notificationPreferences.inAppEnabled,
      slackEnabled: notificationPreferences.slackEnabled,
      minSeverity: notificationPreferences.minSeverity,
      minConfidence: notificationPreferences.minConfidence,
      frequency: notificationPreferences.frequency,
      unsubscribedTypes: notificationPreferences.unsubscribedTypes,
      email: users.email,
      emailValid: users.emailValid,
      externalAuthId: users.externalAuthId,
      name: users.name,
      timezone: users.timezone,
      globalSnoozeUntil: users.globalSnoozeUntil,
      role: tenantMemberships.role,
    })
    .from(notificationPreferences)
    .innerJoin(users, eq(notificationPreferences.userId, users.id))
    .innerJoin(
      tenantMemberships,
      and(
        eq(tenantMemberships.tenantId, notificationPreferences.tenantId),
        eq(tenantMemberships.userId, notificationPreferences.userId),
        isNull(tenantMemberships.deletedAt),
      ),
    );

  let sent = 0;

  for (const row of rows) {
    if (row.frequency !== 'daily') continue;
    if ((row.unsubscribedTypes ?? []).includes('daily_digest')) continue;
    if (isSnoozed(row.globalSnoozeUntil)) continue;

    const timezone = row.timezone ?? 'UTC';
    if (localHour(timezone) !== row.digestHourLocal) continue;

    const todayKey = localDateKey(timezone);
    const dedupeKey = `digest:${row.userId}:${todayKey}`;
    const tenantSettings = await getTenantNotificationSettings(db, row.tenantId);
    if (!tenantSettings.enabled || !tenantSettings.digestEnabled) continue;

    const auth: AuthContext = {
      userId: row.userId,
      tenantId: row.tenantId,
      role: row.role,
      email: row.email,
      externalAuthId: row.externalAuthId,
      name: row.name,
    };

    const summary = await getDashboardSummary(db, row.tenantId, auth);
    if (summary.atRiskProjects === 0) continue;

    const since = row.lastDigestSentAt ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const changedRisks = await withTenantContext(db, row.tenantId, async () =>
      db
        .select({ reason: risks.reason, level: risks.level, confidence: risks.confidence })
        .from(risks)
        .innerJoin(projects, eq(risks.projectId, projects.id))
        .where(
          and(
            eq(risks.tenantId, row.tenantId),
            inArray(risks.status, ['open', 'acknowledged', 'snoozed']),
            isNull(risks.deletedAt),
            gte(risks.updatedAt, since),
            sql`${risks.level} IN ('high', 'critical')`,
          ),
        )
        .orderBy(desc(risks.score))
        .limit(10),
    );

    const filtered = changedRisks.filter(
      (risk) =>
        meetsSeverityThreshold(risk.level as RiskLevel, row.minSeverity as RiskLevel) &&
        risk.confidence >= row.minConfidence,
    );

    if (filtered.length === 0) continue;

    const token = await ensureUnsubscribeToken(db, row.userId);
    const dashboardUrl = `${env.WEB_APP_URL}/dashboard`;
    const unsubscribeUrl = `${env.WEB_APP_URL}/notifications/unsubscribe?token=${token}&type=daily_digest`;
    const digest = buildDigestBody({
      atRiskCount: summary.atRiskProjects,
      totalDelayedArr: summary.totalDelayedArr,
      currency: summary.currency,
      multiCurrency: summary.multiCurrency,
      revenueImpactLabel: formatPortfolioRevenueImpact({
        totalDelayedArr: summary.totalDelayedArr,
        currency: summary.currency,
        multiCurrency: summary.multiCurrency,
        currencyBreakdown: summary.currencyBreakdown,
      }),
      topRisks: filtered.slice(0, 3).map((risk) => risk.reason),
      dashboardUrl,
      unsubscribeUrl,
    });

    const digestChannels: NotificationChannel[] = [];
    if (row.emailEnabled) digestChannels.push('email');
    if (row.inAppEnabled) digestChannels.push('in_app');
    if (row.slackEnabled) digestChannels.push('slack');

    await deliverChannels(
      db,
      {
        tenantId: row.tenantId,
        userId: row.userId,
        channel: 'email',
        notificationType: 'daily_digest',
        dedupeKey,
        toEmail: row.emailValid ? row.email : undefined,
        subject: digest.subject,
        text: digest.text,
        html: digest.html,
        title: digest.subject,
        body: digest.text,
        metadata: { atRiskProjects: summary.atRiskProjects },
      },
      digestChannels,
    );

    await withTenantContext(db, row.tenantId, async () => {
      await db
        .update(notificationPreferences)
        .set({ lastDigestSentAt: new Date(), updatedAt: new Date() })
        .where(
          and(
            eq(notificationPreferences.tenantId, row.tenantId),
            eq(notificationPreferences.userId, row.userId),
          ),
        );
    });

    sent += 1;
  }

  return sent;
}

export async function markEmailBounced(db: Database, userId: string) {
  await db.update(users).set({ emailValid: false, updatedAt: new Date() }).where(eq(users.id, userId));
}
