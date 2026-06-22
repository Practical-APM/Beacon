import {
  calendarProjectSignals,
  events,
  integrations,
  milestones,
  projects,
  slackChannelSignals,
  taskDependencies,
  tasks,
  tenants,
  withTenantContext,
  type Database,
} from '@beacon/db';
import { isPastDueGoLive, shouldExcludeFromActivePortfolio, findCyclicDirectedEdgeKeys, buildDirectedEdgeKey } from '@beacon/shared/graph';
import { mergeRiskSettings, type TenantRiskSettings } from '@beacon/shared';
import { and, eq, inArray, isNull, sql, desc } from 'drizzle-orm';

export interface TaskSnapshot {
  id: string;
  title: string;
  status: string;
  statusCategory: string;
  assigneeEmail: string | null;
  assigneeName: string | null;
  dueDate: Date | null;
  labels: string[];
  isCritical: boolean;
  priority: string | null;
  updatedAt: Date;
}

export interface MilestoneSnapshot {
  id: string;
  name: string;
  status: string;
  dueDate: Date | null;
  completedAt: Date | null;
  updatedAt: Date;
}

export interface DependencySnapshot {
  taskId: string;
  dependsOnTaskId: string;
  blockedTask: TaskSnapshot;
  blockingTask: TaskSnapshot;
}

export interface ProjectSlackSignals {
  lastCustomerMessageAt: Date | null;
  lastInternalResponseAt: Date | null;
  lastActivityAt: Date | null;
  channelsMissingBot: number;
  slackConnected: boolean;
}

export interface ProjectCalendarSignals {
  lastMeetingAt: Date | null;
  lastCustomerMeetingAt: Date | null;
  meetingCount30d: number;
  calendarConnected: boolean;
}

export interface ProjectEvaluationContext {
  project: typeof projects.$inferSelect;
  customerName: string | null;
  milestones: MilestoneSnapshot[];
  tasks: TaskSnapshot[];
  dependencies: DependencySnapshot[];
  lastActivityAt: Date | null;
  jiraConnected: boolean;
  salesforceConnected: boolean;
  slackSignals: ProjectSlackSignals | null;
  calendarSignals: ProjectCalendarSignals | null;
  settings: ReturnType<typeof mergeRiskSettings>;
}

function mapTask(row: typeof tasks.$inferSelect): TaskSnapshot {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    statusCategory: row.statusCategory,
    assigneeEmail: row.assigneeEmail,
    assigneeName: row.assigneeName,
    dueDate: row.dueDate,
    labels: row.labels ?? [],
    isCritical: row.isCritical,
    priority: row.priority,
    updatedAt: row.updatedAt,
  };
}

export async function loadProjectEvaluationContext(
  db: Database,
  tenantId: string,
  projectId: string,
): Promise<ProjectEvaluationContext | null> {
  return withTenantContext(db, tenantId, async () => {
    const [project] = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.tenantId, tenantId), isNull(projects.deletedAt)))
      .limit(1);

    if (!project) return null;

    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
    const settings = mergeRiskSettings((tenant?.riskSettings ?? {}) as TenantRiskSettings);

    const milestoneRows = await db
      .select()
      .from(milestones)
      .where(and(eq(milestones.projectId, projectId), isNull(milestones.deletedAt)));

    const taskRows = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.projectId, projectId), isNull(tasks.deletedAt)));

    const taskMap = new Map(taskRows.map((row) => [row.id, mapTask(row)]));
    const dependencyRows = await db
      .select()
      .from(taskDependencies)
      .where(eq(taskDependencies.tenantId, tenantId));

    const dependencies: DependencySnapshot[] = [];
    for (const dep of dependencyRows) {
      const blockedTask = taskMap.get(dep.taskId);
      const blockingTask = taskMap.get(dep.dependsOnTaskId);
      if (!blockedTask || !blockingTask) continue;
      if (blockedTask.statusCategory === 'done' || blockedTask.status === 'done') continue;
      dependencies.push({
        taskId: dep.taskId,
        dependsOnTaskId: dep.dependsOnTaskId,
        blockedTask,
        blockingTask,
      });
    }

    const cyclicKeys = findCyclicDirectedEdgeKeys(
      dependencies.map((dep) => ({ fromId: dep.dependsOnTaskId, toId: dep.taskId })),
    );
    const acyclicDependencies =
      cyclicKeys.size === 0
        ? dependencies
        : dependencies.filter(
            (dep) =>
              !cyclicKeys.has(buildDirectedEdgeKey(dep.dependsOnTaskId, dep.taskId)),
          );

    const [latestEvent] = await db
      .select({ occurredAt: events.occurredAt })
      .from(events)
      .where(and(eq(events.tenantId, tenantId), eq(events.projectId, projectId)))
      .orderBy(desc(events.occurredAt))
      .limit(1);

    const latestTaskUpdate = taskRows.reduce<Date | null>((latest, row) => {
      if (!latest || row.updatedAt > latest) return row.updatedAt;
      return latest;
    }, null);

    const integrationRows = await db
      .select({ source: integrations.source, status: integrations.status })
      .from(integrations)
      .where(eq(integrations.tenantId, tenantId));

    const slackSignalRows = await db
      .select()
      .from(slackChannelSignals)
      .where(
        and(eq(slackChannelSignals.tenantId, tenantId), eq(slackChannelSignals.projectId, projectId)),
      );

    const slackConnected = integrationRows.some(
      (row) => row.source === 'slack' && row.status !== 'disconnected',
    );

    const slackSignals: ProjectSlackSignals | null =
      slackSignalRows.length > 0 || slackConnected
        ? {
            lastCustomerMessageAt: slackSignalRows.reduce<Date | null>((latest, row) => {
              if (!row.lastCustomerMessageAt) return latest;
              if (!latest || row.lastCustomerMessageAt > latest) return row.lastCustomerMessageAt;
              return latest;
            }, null),
            lastInternalResponseAt: slackSignalRows.reduce<Date | null>((latest, row) => {
              if (!row.lastInternalResponseAt) return latest;
              if (!latest || row.lastInternalResponseAt > latest) return row.lastInternalResponseAt;
              return latest;
            }, null),
            lastActivityAt: slackSignalRows.reduce<Date | null>((latest, row) => {
              if (!row.lastActivityAt) return latest;
              if (!latest || row.lastActivityAt > latest) return row.lastActivityAt;
              return latest;
            }, null),
            channelsMissingBot: slackSignalRows.filter((row) => !row.botPresent).length,
            slackConnected,
          }
        : null;

    const calendarSignalRows = await db
      .select()
      .from(calendarProjectSignals)
      .where(
        and(
          eq(calendarProjectSignals.tenantId, tenantId),
          eq(calendarProjectSignals.projectId, projectId),
        ),
      );

    const calendarConnected = integrationRows.some(
      (row) => row.source === 'google_calendar' && row.status !== 'disconnected',
    );

    const calendarSignals: ProjectCalendarSignals | null =
      calendarSignalRows.length > 0 || calendarConnected
        ? {
            lastMeetingAt: calendarSignalRows.reduce<Date | null>((latest, row) => {
              if (!row.lastMeetingAt) return latest;
              if (!latest || row.lastMeetingAt > latest) return row.lastMeetingAt;
              return latest;
            }, null),
            lastCustomerMeetingAt: calendarSignalRows.reduce<Date | null>((latest, row) => {
              if (!row.lastCustomerMeetingAt) return latest;
              if (!latest || row.lastCustomerMeetingAt > latest) return row.lastCustomerMeetingAt;
              return latest;
            }, null),
            meetingCount30d: calendarSignalRows.reduce((sum, row) => sum + row.meetingCount30d, 0),
            calendarConnected,
          }
        : null;

    const activityCandidates = [
      latestEvent?.occurredAt,
      latestTaskUpdate,
      project.updatedAt,
      calendarSignals?.lastMeetingAt ?? null,
      slackSignals?.lastActivityAt ?? null,
    ].filter((value): value is Date => value instanceof Date);
    const lastActivityAt =
      activityCandidates.length > 0
        ? activityCandidates.reduce((latest, current) => (current > latest ? current : latest))
        : null;

    return {
      project,
      customerName: null,
      milestones: milestoneRows.map((row) => ({
        id: row.id,
        name: row.name,
        status: row.status,
        dueDate: row.dueDate,
        completedAt: row.completedAt,
        updatedAt: row.updatedAt,
      })),
      tasks: taskRows.map(mapTask),
      dependencies: acyclicDependencies,
      lastActivityAt,
      jiraConnected: integrationRows.some(
        (row) => row.source === 'jira' && row.status !== 'disconnected',
      ),
      salesforceConnected: integrationRows.some(
        (row) => row.source === 'salesforce' && row.status !== 'disconnected',
      ),
      slackSignals,
      calendarSignals,
      settings,
    };
  });
}

export async function listActiveProjectIds(
  db: Database,
  tenantId: string,
  projectId?: string,
): Promise<string[]> {
  return withTenantContext(db, tenantId, async () => {
    const rows = await db
      .select({ id: projects.id, status: projects.status })
      .from(projects)
      .where(
        and(
          eq(projects.tenantId, tenantId),
          isNull(projects.deletedAt),
          projectId ? eq(projects.id, projectId) : undefined,
        ),
      );

    return rows
      .filter((row) => !shouldExcludeFromActivePortfolio(row.status))
      .map((row) => row.id);
  });
}

export function isOpenTask(task: TaskSnapshot): boolean {
  return task.statusCategory !== 'done' && task.status !== 'done' && task.status !== 'completed';
}

export function isPastDue(date: Date | null, now = new Date()): boolean {
  return Boolean(date && date.getTime() < now.getTime());
}

export function isPastDueGoLiveProject(project: typeof projects.$inferSelect): boolean {
  return isPastDueGoLive(project.targetGoLiveDate, project.status);
}

export async function listTenantIds(db: Database): Promise<string[]> {
  const rows = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(isNull(tenants.deletedAt));
  return rows.map((row) => row.id);
}

export async function listProjectsForBatchEvaluation(
  db: Database,
  tenantId: string,
): Promise<Array<{ id: string; status: string }>> {
  return withTenantContext(db, tenantId, async () =>
    db
      .select({ id: projects.id, status: projects.status })
      .from(projects)
      .where(and(eq(projects.tenantId, tenantId), isNull(projects.deletedAt))),
  );
}

export async function markProjectsEvaluated(db: Database, tenantId: string, projectIds: string[]) {
  if (projectIds.length === 0) return;
  await withTenantContext(db, tenantId, async () => {
    await db
      .update(projects)
      .set({ updatedAt: sql`GREATEST(${projects.updatedAt}, NOW())` })
      .where(and(eq(projects.tenantId, tenantId), inArray(projects.id, projectIds)));
  });
}
