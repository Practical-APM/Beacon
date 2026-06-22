import {
  customers,
  graphEdges,
  graphRebuildJobs,
  milestones,
  projects,
  taskDependencies,
  tasks,
  withTenantContext,
  type Database,
} from '@beacon/db';
import { isPastDueGoLive, ownerCanonicalKey } from '@beacon/shared/graph';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { runInBackground } from '../../lib/background-job.js';
import {
  resolveOwnerEntities,
  syncProjectMappingEntityLinks,
} from './entity-resolution.js';

type EdgeInsert = {
  fromNodeType: 'customer' | 'project' | 'milestone' | 'task' | 'owner' | 'revenue';
  fromNodeId: string;
  toNodeType: 'customer' | 'project' | 'milestone' | 'task' | 'owner' | 'revenue';
  toNodeId: string;
  edgeType: 'contains' | 'assigned_to' | 'blocks' | 'has_revenue' | 'maps_to';
  projectId: string;
  metadata?: Record<string, unknown>;
};

export interface GraphRebuildResult {
  jobId: string;
  edgesBuilt: number;
  entitiesResolved: number;
  rebuildType: 'full' | 'incremental';
}

async function applyLifecycleRules(db: Database, tenantId: string, projectIds?: string[]) {
  await withTenantContext(db, tenantId, async () => {
    const rows = await db
      .select()
      .from(projects)
      .where(
        and(
          eq(projects.tenantId, tenantId),
          isNull(projects.deletedAt),
          eq(projects.status, 'active'),
          projectIds?.length ? inArray(projects.id, projectIds) : undefined,
        ),
      );

    for (const project of rows) {
      const projectMilestones = await db
        .select()
        .from(milestones)
        .where(and(eq(milestones.projectId, project.id), isNull(milestones.deletedAt)));

      const allMilestonesDone =
        projectMilestones.length > 0 &&
        projectMilestones.every((milestone) => milestone.status === 'completed' || milestone.completedAt);

      const goLivePassed =
        project.targetGoLiveDate && project.targetGoLiveDate.getTime() < Date.now();

      if (goLivePassed && allMilestonesDone) {
        await db
          .update(projects)
          .set({ status: 'completed', updatedAt: new Date() })
          .where(eq(projects.id, project.id));
      }
    }
  });
}

async function ensureDefaultMilestone(db: Database, tenantId: string, projectId: string) {
  return withTenantContext(db, tenantId, async () => {
    const orphanTasks = await db
      .select({ id: tasks.id })
      .from(tasks)
      .where(
        and(
          eq(tasks.projectId, projectId),
          isNull(tasks.milestoneId),
          isNull(tasks.deletedAt),
        ),
      );

    if (orphanTasks.length === 0) return null;

    const [existing] = await db
      .select()
      .from(milestones)
      .where(
        and(
          eq(milestones.projectId, projectId),
          eq(milestones.name, 'Uncategorized Work'),
          isNull(milestones.deletedAt),
        ),
      )
      .limit(1);

    let milestone = existing;
    if (!milestone) {
      const inserted = await db
        .insert(milestones)
        .values({
          tenantId,
          projectId,
          name: 'Uncategorized Work',
          status: 'open',
          externalSource: 'jira',
          externalId: `orphan-root:${projectId}`,
        })
        .returning();
      milestone = inserted[0];
    }

    if (milestone) {
      await db
        .update(tasks)
        .set({ milestoneId: milestone.id, updatedAt: new Date() })
        .where(
          and(eq(tasks.projectId, projectId), isNull(tasks.milestoneId), isNull(tasks.deletedAt)),
        );
    }

    return milestone ?? null;
  });
}

async function buildEdgesForProject(db: Database, tenantId: string, projectId: string): Promise<EdgeInsert[]> {
  return withTenantContext(db, tenantId, async () => {
    const [project] = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.tenantId, tenantId), isNull(projects.deletedAt)))
      .limit(1);
    if (!project) return [];

    const [customer] = await db
      .select()
      .from(customers)
      .where(eq(customers.id, project.customerId))
      .limit(1);

    await ensureDefaultMilestone(db, tenantId, projectId);

    const projectMilestones = await db
      .select()
      .from(milestones)
      .where(and(eq(milestones.projectId, projectId), isNull(milestones.deletedAt)));

    const projectTasks = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.projectId, projectId), isNull(tasks.deletedAt)));

    const dependencies = await db
      .select()
      .from(taskDependencies)
      .where(eq(taskDependencies.tenantId, tenantId));

    const edges: EdgeInsert[] = [];

    if (customer) {
      edges.push({
        fromNodeType: 'customer',
        fromNodeId: customer.id,
        toNodeType: 'project',
        toNodeId: project.id,
        edgeType: 'contains',
        projectId,
      });
    }

    for (const milestone of projectMilestones) {
      edges.push({
        fromNodeType: 'project',
        fromNodeId: project.id,
        toNodeType: 'milestone',
        toNodeId: milestone.id,
        edgeType: 'contains',
        projectId,
      });
    }

    for (const task of projectTasks) {
      if (task.milestoneId) {
        edges.push({
          fromNodeType: 'milestone',
          fromNodeId: task.milestoneId,
          toNodeType: 'task',
          toNodeId: task.id,
          edgeType: 'contains',
          projectId,
        });
      } else {
        edges.push({
          fromNodeType: 'project',
          fromNodeId: project.id,
          toNodeType: 'task',
          toNodeId: task.id,
          edgeType: 'contains',
          projectId,
        });
      }

      const ownerKey = ownerCanonicalKey(task.assigneeEmail);
      if (ownerKey) {
        edges.push({
          fromNodeType: 'task',
          fromNodeId: task.id,
          toNodeType: 'owner',
          toNodeId: ownerKey,
          edgeType: 'assigned_to',
          projectId,
        });
      }
    }

    const projectOwnerKey = ownerCanonicalKey(project.ownerEmail);
    if (projectOwnerKey) {
      edges.push({
        fromNodeType: 'project',
        fromNodeId: project.id,
        toNodeType: 'owner',
        toNodeId: projectOwnerKey,
        edgeType: 'assigned_to',
        projectId,
        metadata: { role: 'project_owner' },
      });
    }

    if (project.arrAmount != null) {
      edges.push({
        fromNodeType: 'project',
        fromNodeId: project.id,
        toNodeType: 'revenue',
        toNodeId: `${project.id}:arr`,
        edgeType: 'has_revenue',
        projectId,
        metadata: {
          arrAmount: project.arrAmount,
          arrCurrency: project.arrCurrency,
          source: 'salesforce',
        },
      });
    }

    if (isPastDueGoLive(project.targetGoLiveDate, project.status)) {
      edges.push({
        fromNodeType: 'project',
        fromNodeId: project.id,
        toNodeType: 'project',
        toNodeId: `${project.id}:signal:past_due_go_live`,
        edgeType: 'contains',
        projectId,
        metadata: { signal: 'past_due_go_live' },
      });
    }

    const taskIds = new Set(projectTasks.map((task) => task.id));
    for (const dep of dependencies) {
      if (!taskIds.has(dep.taskId) || !taskIds.has(dep.dependsOnTaskId)) continue;
      edges.push({
        fromNodeType: 'task',
        fromNodeId: dep.dependsOnTaskId,
        toNodeType: 'task',
        toNodeId: dep.taskId,
        edgeType: 'blocks',
        projectId,
        metadata: { linkType: dep.linkType },
      });
    }

    return edges;
  });
}

export async function runGraphRebuild(
  db: Database,
  tenantId: string,
  rebuildType: 'full' | 'incremental' = 'full',
  projectId?: string,
): Promise<GraphRebuildResult> {
  const job = await withTenantContext(db, tenantId, async () => {
    const [row] = await db
      .insert(graphRebuildJobs)
      .values({
        tenantId,
        rebuildType,
        status: 'running',
        projectId: projectId ?? null,
        startedAt: new Date(),
      })
      .returning();
    return row!;
  });

  try {
    const entitiesResolved =
      (await resolveOwnerEntities(db, tenantId)) + (await syncProjectMappingEntityLinks(db, tenantId));

    await applyLifecycleRules(db, tenantId, projectId ? [projectId] : undefined);

    const projectIds = await withTenantContext(db, tenantId, async () => {
      if (projectId) return [projectId];
      const rows = await db
        .select({ id: projects.id })
        .from(projects)
        .where(and(eq(projects.tenantId, tenantId), isNull(projects.deletedAt)));
      return rows.map((row) => row.id);
    });

    if (rebuildType === 'full' && !projectId) {
      await withTenantContext(db, tenantId, async () => {
        await db.delete(graphEdges).where(eq(graphEdges.tenantId, tenantId));
      });
    } else if (projectId) {
      await withTenantContext(db, tenantId, async () => {
        await db.delete(graphEdges).where(and(eq(graphEdges.tenantId, tenantId), eq(graphEdges.projectId, projectId)));
      });
    }

    let edgesBuilt = 0;
    for (const id of projectIds) {
      const edges = await buildEdgesForProject(db, tenantId, id);
      if (edges.length === 0) continue;

      await withTenantContext(db, tenantId, async () => {
        for (const edge of edges) {
          await db
            .insert(graphEdges)
            .values({
              tenantId,
              ...edge,
              rebuiltAt: new Date(),
            })
            .onConflictDoUpdate({
              target: [
                graphEdges.tenantId,
                graphEdges.fromNodeType,
                graphEdges.fromNodeId,
                graphEdges.toNodeType,
                graphEdges.toNodeId,
                graphEdges.edgeType,
              ],
              set: {
                projectId: edge.projectId,
                metadata: edge.metadata ?? {},
                rebuiltAt: new Date(),
              },
            });
        }
      });
      edgesBuilt += edges.length;
    }

    await withTenantContext(db, tenantId, async () => {
      await db
        .update(graphRebuildJobs)
        .set({
          status: 'completed',
          edgesBuilt,
          entitiesResolved,
          completedAt: new Date(),
        })
        .where(eq(graphRebuildJobs.id, job.id));
    });

    const { scheduleRiskEvaluation } = await import('../risk/engine.js');
    scheduleRiskEvaluation(db, tenantId, projectId);

    return { jobId: job.id, edgesBuilt, entitiesResolved, rebuildType };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Graph rebuild failed';
    await withTenantContext(db, tenantId, async () => {
      await db
        .update(graphRebuildJobs)
        .set({
          status: 'failed',
          error: message,
          completedAt: new Date(),
        })
        .where(eq(graphRebuildJobs.id, job.id));
    });
    throw error;
  }
}

export async function getLatestGraphRebuildJob(db: Database, tenantId: string) {
  return withTenantContext(db, tenantId, async () => {
    const [row] = await db
      .select()
      .from(graphRebuildJobs)
      .where(eq(graphRebuildJobs.tenantId, tenantId))
      .orderBy(desc(graphRebuildJobs.createdAt))
      .limit(1);
    return row ?? null;
  });
}

export function startGraphRebuild(
  db: Database,
  tenantId: string,
  rebuildType: 'full' | 'incremental' = 'full',
  projectId?: string,
) {
  runInBackground(
    'graph-rebuild',
    () => runGraphRebuild(db, tenantId, rebuildType, projectId),
    { tenantId, rebuildType, projectId },
  );
}
