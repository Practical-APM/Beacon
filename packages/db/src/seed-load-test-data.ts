import { and, eq } from 'drizzle-orm';
import {
  createDb,
  customers,
  events,
  projects,
  tasks,
  tenants,
  withTenantContext,
} from './index.js';
import { seedTenants } from './seed-helpers.js';

const PROJECT_COUNT = 50;
const TASK_COUNT = 10_000;
const EVENT_COUNT = 100_000;
const BATCH_SIZE = 1_000;

export interface LoadTestSeedResult {
  tenantId: string;
  customerId: string;
  projectIds: string[];
  taskCount: number;
  eventCount: number;
}

export async function seedLoadTestData(
  connectionString: string,
  tenantSlug = 'acme-demo',
): Promise<LoadTestSeedResult | null> {
  const { db } = createDb(connectionString);
  await seedTenants(connectionString);

  const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, tenantSlug)).limit(1);
  if (!tenant) return null;

  const customerExternalId = 'load-test-customer';
  let [customer] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.tenantId, tenant.id), eq(customers.externalId, customerExternalId)))
    .limit(1);

  if (!customer) {
    [customer] = await db
      .insert(customers)
      .values({
        tenantId: tenant.id,
        name: 'Load Test Customer',
        externalId: customerExternalId,
        externalSource: 'salesforce',
      })
      .returning();
  }

  if (!customer) return null;

  const projectIds: string[] = [];
  for (let i = 1; i <= PROJECT_COUNT; i += 1) {
    const name = `Load Test Project ${i}`;
    const [existing] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.tenantId, tenant.id), eq(projects.name, name)))
      .limit(1);

    if (existing) {
      projectIds.push(existing.id);
      continue;
    }

    const [project] = await db
      .insert(projects)
      .values({
        tenantId: tenant.id,
        customerId: customer.id,
        name,
        status: 'active',
        targetGoLiveDate: new Date(Date.now() + (i % 60) * 24 * 60 * 60 * 1000),
        arrAmount: 10_000 + i * 100,
        arrCurrency: 'USD',
        ownerName: 'Load Test Owner',
        ownerEmail: 'contributor-a@acme-demo.test',
        dataComplete: true,
      })
      .returning({ id: projects.id });

    if (project) projectIds.push(project.id);
  }

  const tasksPerProject = Math.ceil(TASK_COUNT / projectIds.length);
  let insertedTasks = 0;

  for (const projectId of projectIds) {
    const batch: Array<typeof tasks.$inferInsert> = [];
    for (let i = 0; i < tasksPerProject && insertedTasks < TASK_COUNT; i += 1) {
      insertedTasks += 1;
      batch.push({
        tenantId: tenant.id,
        projectId,
        externalId: `load-task-${projectId.slice(0, 8)}-${i}`,
        externalSource: 'jira',
        title: `Load task ${insertedTasks}`,
        status: i % 5 === 0 ? 'blocked' : 'open',
        statusCategory: i % 5 === 0 ? 'blocked' : 'in_progress',
        assigneeEmail: 'contributor-a@acme-demo.test',
      });
    }

    for (let offset = 0; offset < batch.length; offset += BATCH_SIZE) {
      await withTenantContext(db, tenant.id, async () => {
        await db
          .insert(tasks)
          .values(batch.slice(offset, offset + BATCH_SIZE))
          .onConflictDoNothing({
            target: [tasks.tenantId, tasks.externalSource, tasks.externalId],
          });
      });
    }
  }

  let insertedEvents = 0;
  while (insertedEvents < EVENT_COUNT) {
    const batch: Array<typeof events.$inferInsert> = [];
    for (let i = 0; i < BATCH_SIZE && insertedEvents < EVENT_COUNT; i += 1) {
      insertedEvents += 1;
      const projectId = projectIds[insertedEvents % projectIds.length]!;
      batch.push({
        tenantId: tenant.id,
        projectId,
        eventSchemaVersion: 1,
        eventType: 'jira_issue_updated',
        source: 'jira',
        externalId: `issue-${insertedEvents}`,
        externalEventId: `load-event-${insertedEvents}`,
        payload: { summary: `Load event ${insertedEvents}` },
        occurredAt: new Date(Date.now() - (insertedEvents % 10_000) * 60_000),
      });
    }

    await withTenantContext(db, tenant.id, async () => {
      await db
        .insert(events)
        .values(batch)
        .onConflictDoNothing({
          target: [events.tenantId, events.source, events.externalEventId],
        });
    });
  }

  return {
    tenantId: tenant.id,
    customerId: customer.id,
    projectIds,
    taskCount: insertedTasks,
    eventCount: insertedEvents,
  };
}
