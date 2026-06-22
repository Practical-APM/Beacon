import { and, eq } from 'drizzle-orm';
import {
  createDb,
  customers,
  milestones,
  projects,
  recommendations,
  risks,
  tasks,
  tenants,
} from './index.js';
import { seedTenants } from './seed-helpers.js';

export async function seedDemoOperationalData(connectionString: string, tenantSlug = 'acme-demo') {
  const { db } = createDb(connectionString);
  await seedTenants(connectionString);

  const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, tenantSlug)).limit(1);
  if (!tenant) return null;

  const existingCustomer = await db
    .select()
    .from(customers)
    .where(and(eq(customers.tenantId, tenant.id), eq(customers.externalId, 'sf-acme-001')))
    .limit(1);

  let customer = existingCustomer[0];
  if (!customer) {
    const inserted = await db
      .insert(customers)
      .values({
        tenantId: tenant.id,
        name: 'Acme Corp',
        externalId: 'sf-acme-001',
        externalSource: 'salesforce',
      })
      .returning();
    customer = inserted[0];
  }

  if (!customer) return null;

  const existingProject = await db
    .select()
    .from(projects)
    .where(and(eq(projects.tenantId, tenant.id), eq(projects.name, 'Acme Corp Implementation')))
    .limit(1);

  let project = existingProject[0];
  if (!project) {
    const inserted = await db
      .insert(projects)
      .values({
        tenantId: tenant.id,
        customerId: customer.id,
        name: 'Acme Corp Implementation',
        status: 'active',
        targetGoLiveDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        arrAmount: 45000,
        arrCurrency: 'USD',
        ownerName: 'Acme Contributor',
        ownerEmail: 'contributor-a@acme-demo.test',
        dataComplete: true,
      })
      .returning();
    project = inserted[0];
  }

  if (!project) return null;

  const existingAdminProject = await db
    .select()
    .from(projects)
    .where(and(eq(projects.tenantId, tenant.id), eq(projects.name, 'Enterprise Rollout (Admin)')))
    .limit(1);

  if (existingAdminProject.length === 0) {
    await db.insert(projects).values({
      tenantId: tenant.id,
      customerId: customer.id,
      name: 'Enterprise Rollout (Admin)',
      status: 'active',
      targetGoLiveDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
      arrAmount: 120000,
      arrCurrency: 'USD',
      ownerName: 'Acme Admin',
      ownerEmail: 'admin-a@acme-demo.test',
      dataComplete: true,
    });
  }

  const existingMilestone = await db
    .select()
    .from(milestones)
    .where(and(eq(milestones.projectId, project.id), eq(milestones.name, 'Security Review')))
    .limit(1);

  if (existingMilestone.length === 0) {
    const [milestone] = await db
      .insert(milestones)
      .values({
        tenantId: tenant.id,
        projectId: project.id,
        name: 'Security Review',
        status: 'in_progress',
        dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        externalSource: 'jira',
        externalId: 'JIRA-100',
      })
      .returning();

    if (milestone) {
      await db.insert(tasks).values({
        tenantId: tenant.id,
        projectId: project.id,
        milestoneId: milestone.id,
        title: 'Complete customer security questionnaire',
        status: 'blocked',
        statusCategory: 'in_progress',
        isCritical: true,
        labels: ['waiting_on_customer', 'customer-facing'],
        externalSource: 'jira',
        externalId: 'JIRA-101',
        updatedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
      });
    }
  }

  const existingRisk = await db
    .select()
    .from(risks)
    .where(and(eq(risks.projectId, project.id), eq(risks.reason, 'Customer security review inactive')))
    .limit(1);

  let riskId = existingRisk[0]?.id ?? '';
  if (existingRisk.length === 0) {
    const [risk] = await db
      .insert(risks)
      .values({
        tenantId: tenant.id,
        projectId: project.id,
        level: 'high',
        status: 'open',
        score: 85,
        reason: 'Customer security review inactive',
        ruleKey: 'customer_response_delay',
        confidence: 78,
        predictedDelayDays: 14,
        evidence: [
          {
            source: 'jira',
            signal: 'milestone_stalled',
            description: 'Security review inactive for 18 days',
          },
        ],
      })
      .returning();

    if (risk) {
      riskId = risk.id;
      await db.insert(recommendations).values({
        tenantId: tenant.id,
        projectId: project.id,
        riskId: risk.id,
        suggestedOwner: 'Customer Security Lead',
        suggestedAction: 'Escalate to customer security owner',
        escalationPath: 'Notify CSM executive sponsor',
        status: 'pending',
      });
    }
  }

  return { tenantId: tenant.id, customerId: customer.id, projectId: project.id, riskId };
}

export async function seedGlobexDemoOperationalData(connectionString: string) {
  const { db } = createDb(connectionString);
  await seedTenants(connectionString);

  const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, 'globex-demo')).limit(1);
  if (!tenant) return null;

  const existingCustomer = await db
    .select()
    .from(customers)
    .where(and(eq(customers.tenantId, tenant.id), eq(customers.externalId, 'sf-globex-001')))
    .limit(1);

  let customer = existingCustomer[0];
  if (!customer) {
    const inserted = await db
      .insert(customers)
      .values({
        tenantId: tenant.id,
        name: 'Globex Industries',
        externalId: 'sf-globex-001',
        externalSource: 'salesforce',
      })
      .returning();
    customer = inserted[0];
  }

  if (!customer) return null;

  const existingProject = await db
    .select()
    .from(projects)
    .where(and(eq(projects.tenantId, tenant.id), eq(projects.name, 'Globex Platform Rollout')))
    .limit(1);

  let project = existingProject[0];
  if (!project) {
    const inserted = await db
      .insert(projects)
      .values({
        tenantId: tenant.id,
        customerId: customer.id,
        name: 'Globex Platform Rollout',
        status: 'active',
        targetGoLiveDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        arrAmount: 90000,
        arrCurrency: 'USD',
        ownerName: 'Globex Admin',
        ownerEmail: 'admin-b@globex-demo.test',
        dataComplete: true,
      })
      .returning();
    project = inserted[0];
  }

  if (!project) return null;

  return { tenantId: tenant.id, customerId: customer.id, projectId: project.id };
}
