import {
  businessDaysBetween,
  computeDataConfidence,
  customerWaitingDaysFromCalendarSignals,
  customerWaitingDaysFromSignals,
  hasSuppressionLabel,
  isBusinessDay,
  isInBlackoutPeriod,
  validateRiskEvidence,
  type DetectedRisk,
  type RiskEvidence,
  type RiskRuleKey,
} from '@beacon/shared';
import { shouldExcludeFromActivePortfolio } from '@beacon/shared/graph';
import {
  isOpenTask,
  isPastDue,
  isPastDueGoLiveProject,
  type ProjectEvaluationContext,
} from './context.js';

const now = () => new Date();

function baseConfidence(ctx: ProjectEvaluationContext): number {
  return computeDataConfidence({
    dataComplete: ctx.project.dataComplete,
    jiraConnected: ctx.jiraConnected,
    salesforceConnected: ctx.salesforceConnected,
    calendarConnected: ctx.calendarSignals?.calendarConnected ?? false,
    ownerEmail: ctx.project.ownerEmail,
  });
}

function evidence(
  source: RiskEvidence['source'],
  signal: string,
  description: string,
  extra?: Partial<RiskEvidence>,
): RiskEvidence[] {
  return validateRiskEvidence([
    {
      source,
      signal,
      description,
      timestamp: now().toISOString(),
      ...extra,
    },
  ]);
}

export function evaluateProjectInactivity(ctx: ProjectEvaluationContext): DetectedRisk | null {
  const rule = ctx.settings.rules.project_inactivity;
  if (!rule.enabled || shouldExcludeFromActivePortfolio(ctx.project.status)) return null;
  if (!isBusinessDay(now(), ctx.settings.timezone)) return null;
  if (hasSuppressionLabel(ctx.tasks.flatMap((task) => task.labels))) return null;
  if (isInBlackoutPeriod(now(), ctx.settings.blackoutPeriods)) return null;

  const threshold = rule.thresholdBusinessDays ?? 10;
  const lastActivity = ctx.lastActivityAt ?? ctx.project.updatedAt;
  const inactiveDays = businessDaysBetween(lastActivity, now(), ctx.settings.timezone);
  if (inactiveDays < threshold) return null;

  return {
    ruleKey: 'project_inactivity',
    reason: `No project activity for ${inactiveDays} business days`,
    level: rule.level,
    score: Math.min(100, rule.baseScore + Math.max(0, inactiveDays - threshold) * 2),
    confidence: Math.max(40, baseConfidence(ctx) - (ctx.jiraConnected ? 0 : 20)),
    evidence: evidence('system', 'project_inactivity', `Last activity ${lastActivity.toISOString()}`, {
      days: inactiveDays,
      entityId: ctx.project.id,
    }),
    predictedDelayDays: 7,
  };
}

export function evaluateCriticalDependencyOverdue(ctx: ProjectEvaluationContext): DetectedRisk | null {
  const rule = ctx.settings.rules.critical_dependency_overdue;
  if (!rule.enabled) return null;

  const overdue = ctx.dependencies.find(({ blockingTask, blockedTask }) => {
    const critical =
      blockingTask.isCritical ||
      blockedTask.isCritical ||
      blockingTask.priority === 'highest' ||
      blockingTask.priority === 'high';
    return critical && isOpenTask(blockingTask) && isPastDue(blockingTask.dueDate);
  });

  if (!overdue) return null;

  const days =
    overdue.blockingTask.dueDate != null
      ? Math.ceil((now().getTime() - overdue.blockingTask.dueDate.getTime()) / (24 * 60 * 60 * 1000))
      : undefined;

  return {
    ruleKey: 'critical_dependency_overdue',
    reason: 'Critical dependency overdue',
    level: rule.level,
    score: rule.baseScore + Math.min(10, days ?? 0),
    confidence: baseConfidence(ctx),
    evidence: evidence(
      'jira',
      'dependency_overdue',
      `Blocking task "${overdue.blockingTask.title}" is overdue`,
      {
        days,
        entityId: overdue.blockingTask.id,
        deepLink: overdue.blockingTask.id,
      },
    ),
    predictedDelayDays: days ?? 14,
  };
}

export function evaluateNoAssignedOwner(ctx: ProjectEvaluationContext): DetectedRisk | null {
  const rule = ctx.settings.rules.no_assigned_owner;
  if (!rule.enabled) return null;

  const unassigned = ctx.tasks.filter((task) => isOpenTask(task) && !task.assigneeEmail);
  if (unassigned.length === 0) return null;

  return {
    ruleKey: 'no_assigned_owner',
    reason: `${unassigned.length} open task${unassigned.length === 1 ? '' : 's'} without an assigned owner`,
    level: rule.level,
    score: Math.min(100, rule.baseScore + Math.min(10, unassigned.length * 2)),
    confidence: baseConfidence(ctx),
    evidence: evidence(
      'jira',
      'unassigned_tasks',
      unassigned.slice(0, 3).map((task) => task.title).join('; '),
      { entityId: unassigned[0]?.id },
    ),
    predictedDelayDays: 5,
  };
}

export function evaluateCustomerResponseDelay(ctx: ProjectEvaluationContext): DetectedRisk | null {
  const rule = ctx.settings.rules.customer_response_delay;
  if (!rule.enabled) return null;

  const threshold = rule.thresholdBusinessDays ?? 14;

  if (ctx.slackSignals?.slackConnected) {
    const waitingDays = customerWaitingDaysFromSignals(
      {
        lastCustomerMessageAt: ctx.slackSignals.lastCustomerMessageAt?.toISOString() ?? null,
        lastInternalResponseAt: ctx.slackSignals.lastInternalResponseAt?.toISOString() ?? null,
        lastActivityAt: ctx.slackSignals.lastActivityAt?.toISOString() ?? null,
      },
      ctx.settings.timezone,
      businessDaysBetween,
    );

    if (waitingDays != null && waitingDays >= threshold) {
      return {
        ruleKey: 'customer_response_delay',
        reason: `Customer response delay (${waitingDays} business days since internal follow-up)`,
        level: rule.level,
        score: Math.min(100, rule.baseScore + Math.max(0, waitingDays - threshold)),
        confidence: Math.max(45, baseConfidence(ctx)),
        evidence: evidence(
          'slack',
          'customer_inactivity',
          `No customer Slack response since ${ctx.slackSignals.lastInternalResponseAt?.toISOString()}`,
          { days: waitingDays },
        ),
        predictedDelayDays: 10,
      };
    }
  }

  if (ctx.calendarSignals?.calendarConnected) {
    const waitingDays = customerWaitingDaysFromCalendarSignals(
      {
        lastCustomerMeetingAt:
          ctx.calendarSignals.lastCustomerMeetingAt?.toISOString() ?? null,
      },
      ctx.settings.timezone,
      businessDaysBetween,
    );

    if (waitingDays != null && waitingDays >= threshold) {
      return {
        ruleKey: 'customer_response_delay',
        reason: `Customer engagement gap (${waitingDays} business days since last customer meeting)`,
        level: rule.level,
        score: Math.min(100, rule.baseScore + Math.max(0, waitingDays - threshold)),
        confidence: Math.max(40, baseConfidence(ctx)),
        evidence: evidence(
          'google_calendar',
          'customer_inactivity',
          `No customer-attended meetings since ${ctx.calendarSignals.lastCustomerMeetingAt?.toISOString()}`,
          { days: waitingDays },
        ),
        predictedDelayDays: 10,
      };
    }
  }

  const waitingTasks = ctx.tasks.filter(
    (task) =>
      isOpenTask(task) &&
      (hasSuppressionLabel(task.labels) ||
        task.labels.some((label) => label.toLowerCase().includes('customer'))),
  );

  if (waitingTasks.length === 0) return null;

  const stalest = waitingTasks.reduce((latest, task) =>
    task.updatedAt < latest.updatedAt ? task : latest,
  );
  const waitingDays = businessDaysBetween(stalest.updatedAt, now(), ctx.settings.timezone);
  if (waitingDays < threshold) return null;

  return {
    ruleKey: 'customer_response_delay',
    reason: `Customer response delay (${waitingDays} business days)`,
    level: rule.level,
    score: Math.min(100, rule.baseScore + Math.max(0, waitingDays - threshold)),
    confidence: Math.max(35, baseConfidence(ctx) - 10),
    evidence: evidence(
      'jira',
      'customer_inactivity',
      `Waiting on customer since ${stalest.updatedAt.toISOString()}`,
      { days: waitingDays, entityId: stalest.id },
    ),
    predictedDelayDays: 10,
  };
}

export function evaluateMilestoneBehindSchedule(ctx: ProjectEvaluationContext): DetectedRisk | null {
  const rule = ctx.settings.rules.milestone_behind_schedule;
  if (!rule.enabled) return null;

  const overdueMilestone = ctx.milestones.find(
    (milestone) =>
      milestone.status !== 'completed' &&
      !milestone.completedAt &&
      isPastDue(milestone.dueDate),
  );
  if (!overdueMilestone) return null;

  const days =
    overdueMilestone.dueDate != null
      ? Math.ceil((now().getTime() - overdueMilestone.dueDate.getTime()) / (24 * 60 * 60 * 1000))
      : undefined;

  return {
    ruleKey: 'milestone_behind_schedule',
    reason: `Milestone "${overdueMilestone.name}" is behind schedule`,
    level: rule.level,
    score: Math.min(100, rule.baseScore + Math.min(15, days ?? 0)),
    confidence: baseConfidence(ctx),
    evidence: evidence(
      'jira',
      'milestone_overdue',
      `Due date passed for ${overdueMilestone.name}`,
      { days, entityId: overdueMilestone.id },
    ),
    predictedDelayDays: days ?? 7,
  };
}

export function evaluatePastDueGoLive(ctx: ProjectEvaluationContext): DetectedRisk | null {
  const rule = ctx.settings.rules.past_due_go_live;
  if (!rule.enabled || !isPastDueGoLiveProject(ctx.project)) return null;

  const goLiveDate = ctx.project.targetGoLiveDate!;
  const calendarDays = Math.ceil((now().getTime() - goLiveDate.getTime()) / (24 * 60 * 60 * 1000));

  return {
    ruleKey: 'past_due_go_live',
    reason: 'Go-live date has passed with project still active',
    level: rule.level,
    score: Math.min(100, rule.baseScore + Math.min(10, calendarDays)),
    confidence: baseConfidence(ctx),
    evidence: evidence(
      'system',
      'past_due_go_live',
      `Target go-live was ${goLiveDate.toISOString()}`,
      { days: calendarDays, entityId: ctx.project.id },
    ),
    predictedDelayDays: calendarDays,
  };
}

const RULE_EVALUATORS: Record<RiskRuleKey, (ctx: ProjectEvaluationContext) => DetectedRisk | null> = {
  project_inactivity: evaluateProjectInactivity,
  critical_dependency_overdue: evaluateCriticalDependencyOverdue,
  no_assigned_owner: evaluateNoAssignedOwner,
  customer_response_delay: evaluateCustomerResponseDelay,
  milestone_behind_schedule: evaluateMilestoneBehindSchedule,
  past_due_go_live: evaluatePastDueGoLive,
};

export function evaluateAllRules(ctx: ProjectEvaluationContext): DetectedRisk[] {
  if (shouldExcludeFromActivePortfolio(ctx.project.status)) {
    return [];
  }

  return Object.values(RULE_EVALUATORS)
    .map((evaluate) => evaluate(ctx))
    .filter((result): result is DetectedRisk => result !== null);
}
