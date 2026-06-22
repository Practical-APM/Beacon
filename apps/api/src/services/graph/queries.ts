import {
  customers,
  entityLinks,
  graphEdges,
  integrationMappings,
  projects,
  tasks,
  withTenantContext,
  type Database,
} from '@beacon/db';
import {
  detectCycles,
  isPastDueGoLive,
  shouldExcludeFromActivePortfolio,
  type GraphEdge,
  type GraphNode,
  type GraphSnapshot,
  type OwnerWorkloadEntry,
  type PortfolioProjectSummary,
} from '@beacon/shared/graph';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { getUnlinkedProjects } from './entity-resolution.js';

export async function getProjectGraph(
  db: Database,
  tenantId: string,
  projectId: string,
): Promise<GraphSnapshot> {
  return withTenantContext(db, tenantId, async () => {
    const [project] = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.tenantId, tenantId), isNull(projects.deletedAt)))
      .limit(1);
    if (!project) {
      return { nodes: [], edges: [], warnings: ['Project not found'] };
    }

    const [customer] = await db
      .select()
      .from(customers)
      .where(eq(customers.id, project.customerId))
      .limit(1);

    const edges = await db
      .select()
      .from(graphEdges)
      .where(and(eq(graphEdges.tenantId, tenantId), eq(graphEdges.projectId, projectId)));

    const nodes: GraphNode[] = [];
    if (customer) {
      nodes.push({ id: customer.id, type: 'customer', label: customer.name });
    }
    nodes.push({
      id: project.id,
      type: 'project',
      label: project.name,
      metadata: {
        status: project.status,
        targetGoLiveDate: project.targetGoLiveDate,
        pastDueGoLive: isPastDueGoLive(project.targetGoLiveDate, project.status),
      },
    });

    const mappedEdges: GraphEdge[] = edges.map((edge) => ({
      fromType: edge.fromNodeType,
      fromId: edge.fromNodeId,
      toType: edge.toNodeType,
      toId: edge.toNodeId,
      edgeType: edge.edgeType,
      metadata: (edge.metadata as Record<string, unknown> | null) ?? undefined,
    }));

    for (const edge of mappedEdges) {
      for (const node of [
        { id: edge.fromId, type: edge.fromType },
        { id: edge.toId, type: edge.toType },
      ]) {
        if (nodes.some((existing) => existing.id === node.id && existing.type === node.type)) continue;
        if (node.type === 'owner') {
          nodes.push({ id: node.id, type: 'owner', label: node.id.replace(/^owner:/, '') });
        } else if (node.type === 'revenue') {
          nodes.push({ id: node.id, type: 'revenue', label: 'ARR', metadata: edge.metadata });
        } else if (node.type !== 'customer' && node.type !== 'project') {
          nodes.push({ id: node.id, type: node.type, label: node.id.slice(0, 8) });
        }
      }
    }

    const blockEdges = mappedEdges
      .filter((edge) => edge.edgeType === 'blocks')
      .map((edge) => ({ fromId: edge.fromId, toId: edge.toId }));
    const cycles = detectCycles(blockEdges);
    const warnings: string[] = [];
    if (cycles.length > 0) warnings.push(`Detected ${cycles.length} dependency cycle(s)`);

    return { nodes, edges: mappedEdges, cycles, warnings };
  });
}

export async function getProjectBlockers(db: Database, tenantId: string, projectId: string) {
  const graph = await getProjectGraph(db, tenantId, projectId);
  const blockers = graph.edges.filter((edge) => edge.edgeType === 'blocks');

  const taskIds = blockers.flatMap((edge) => [edge.fromId, edge.toId]);
  const taskRows =
    taskIds.length === 0
      ? []
      : await withTenantContext(db, tenantId, async () =>
          db
            .select({
              id: tasks.id,
              title: tasks.title,
              status: tasks.status,
              statusCategory: tasks.statusCategory,
            })
            .from(tasks)
            .where(and(eq(tasks.projectId, projectId), inArray(tasks.id, taskIds))),
        );

  const taskMap = new Map(taskRows.map((task) => [task.id, task]));

  return {
    blockers: blockers.map((edge) => ({
      blockerTaskId: edge.fromId,
      blockedTaskId: edge.toId,
      blocker: taskMap.get(edge.fromId) ?? null,
      blocked: taskMap.get(edge.toId) ?? null,
    })),
    cycles: graph.cycles ?? [],
    warnings: graph.warnings ?? [],
  };
}

export async function getOwnerWorkload(db: Database, tenantId: string): Promise<OwnerWorkloadEntry[]> {
  return withTenantContext(db, tenantId, async () => {
    const links = await db
      .select()
      .from(entityLinks)
      .where(
        and(eq(entityLinks.tenantId, tenantId), eq(entityLinks.linkType, 'owner'), isNull(entityLinks.deletedAt)),
      );

    const openTasks = await db
      .select({
        id: tasks.id,
        projectId: tasks.projectId,
        assigneeEmail: tasks.assigneeEmail,
        statusCategory: tasks.statusCategory,
        status: tasks.status,
      })
      .from(tasks)
      .innerJoin(projects, eq(tasks.projectId, projects.id))
      .where(
        and(
          eq(tasks.tenantId, tenantId),
          isNull(tasks.deletedAt),
          isNull(projects.deletedAt),
          eq(projects.status, 'active'),
        ),
      );

    const grouped = new Map<string, OwnerWorkloadEntry>();

    for (const link of links) {
      grouped.set(link.canonicalKey, {
        canonicalKey: link.canonicalKey,
        email: link.email,
        displayName: link.displayName,
        openTasks: 0,
        blockedTasks: 0,
        projects: [],
        confidence: link.confidence,
      });
    }

    for (const task of openTasks) {
      const key = task.assigneeEmail ? `owner:${task.assigneeEmail.toLowerCase()}` : null;
      if (!key) continue;
      const entry = grouped.get(key) ?? {
        canonicalKey: key,
        email: task.assigneeEmail,
        displayName: null,
        openTasks: 0,
        blockedTasks: 0,
        projects: [],
        confidence: 100,
      };
      if (task.statusCategory !== 'done') entry.openTasks += 1;
      if (task.status.toLowerCase().includes('block')) entry.blockedTasks += 1;
      if (!entry.projects.includes(task.projectId)) entry.projects.push(task.projectId);
      grouped.set(key, entry);
    }

    return [...grouped.values()].sort((a, b) => b.openTasks - a.openTasks);
  });
}

export async function getPortfolioSummary(
  db: Database,
  tenantId: string,
  includeInactive = false,
): Promise<{ projects: PortfolioProjectSummary[]; unlinked: Awaited<ReturnType<typeof getUnlinkedProjects>> }> {
  const unlinked = await getUnlinkedProjects(db, tenantId);
  const unlinkedIds = new Set(unlinked.map((row) => row.projectId));

  const rows = await withTenantContext(db, tenantId, async () =>
    db
      .select({
        project: projects,
        customerName: customers.name,
      })
      .from(projects)
      .innerJoin(customers, eq(projects.customerId, customers.id))
      .where(and(eq(projects.tenantId, tenantId), isNull(projects.deletedAt))),
  );

  const summaries: PortfolioProjectSummary[] = [];

  for (const row of rows) {
    if (!includeInactive && shouldExcludeFromActivePortfolio(row.project.status)) continue;

    const taskStats = await withTenantContext(db, tenantId, async () => {
      const [stats] = await db
        .select({
          openTasks: sql<number>`count(*) filter (where ${tasks.statusCategory} <> 'done')`,
          blockedTasks: sql<number>`count(*) filter (where lower(${tasks.status}) like '%block%')`,
        })
        .from(tasks)
        .where(and(eq(tasks.projectId, row.project.id), isNull(tasks.deletedAt)));
      return stats;
    });

    summaries.push({
      projectId: row.project.id,
      projectName: row.project.name,
      customerName: row.customerName,
      status: row.project.status,
      targetGoLiveDate: row.project.targetGoLiveDate?.toISOString() ?? null,
      arrAmount: row.project.arrAmount,
      arrCurrency: row.project.arrCurrency,
      ownerEmail: row.project.ownerEmail,
      openTasks: Number(taskStats?.openTasks ?? 0),
      blockedTasks: Number(taskStats?.blockedTasks ?? 0),
      pastDueGoLive: isPastDueGoLive(row.project.targetGoLiveDate, row.project.status),
      unlinkedJira: unlinkedIds.has(row.project.id),
    });
  }

  return { projects: summaries, unlinked };
}

export async function getMappedProjectIds(db: Database, tenantId: string): Promise<Set<string>> {
  const rows = await withTenantContext(db, tenantId, async () =>
    db
      .select({ internalId: integrationMappings.internalId })
      .from(integrationMappings)
      .where(
        and(
          eq(integrationMappings.tenantId, tenantId),
          eq(integrationMappings.mappingType, 'project_to_jira'),
          isNull(integrationMappings.deletedAt),
        ),
      ),
  );
  return new Set(rows.map((row) => row.internalId));
}
