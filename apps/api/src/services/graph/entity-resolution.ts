import {
  customers,
  entityLinks,
  integrationMappings,
  milestones,
  projects,
  tasks,
  withTenantContext,
  type Database,
} from '@beacon/db';
import { normalizeEmail, ownerCanonicalKey } from '@beacon/shared/graph';
import type { IntegrationSource } from '@beacon/shared/constants';
import { and, eq, isNull, sql } from 'drizzle-orm';

interface OwnerCandidate {
  email: string;
  displayName: string | null;
  source: IntegrationSource;
  externalId: string;
}

export async function resolveOwnerEntities(db: Database, tenantId: string): Promise<number> {
  return withTenantContext(db, tenantId, async () => {
    const candidates: OwnerCandidate[] = [];

    const projectOwners = await db
      .select({
        email: projects.ownerEmail,
        name: projects.ownerName,
        id: projects.id,
        source: projects.externalSource,
      })
      .from(projects)
      .where(and(eq(projects.tenantId, tenantId), isNull(projects.deletedAt)));

    for (const row of projectOwners) {
      const email = normalizeEmail(row.email);
      if (!email) continue;
      candidates.push({
        email,
        displayName: row.name,
        source: row.source ?? 'salesforce',
        externalId: `project-owner:${row.id}`,
      });
    }

    const taskAssignees = await db
      .select({
        email: tasks.assigneeEmail,
        name: tasks.assigneeName,
        id: tasks.id,
        source: tasks.externalSource,
      })
      .from(tasks)
      .where(and(eq(tasks.tenantId, tenantId), isNull(tasks.deletedAt)));

    for (const row of taskAssignees) {
      const email = normalizeEmail(row.email);
      if (!email) continue;
      candidates.push({
        email,
        displayName: row.name,
        source: row.source ?? 'jira',
        externalId: `task-assignee:${row.id}`,
      });
    }

    let resolved = 0;
    for (const candidate of candidates) {
      const canonicalKey = ownerCanonicalKey(candidate.email);
      if (!canonicalKey) continue;

      await db
        .insert(entityLinks)
        .values({
          tenantId,
          linkType: 'owner',
          canonicalKey,
          source: candidate.source,
          externalId: candidate.externalId,
          displayName: candidate.displayName,
          email: candidate.email,
          confidence: 100,
          resolutionMethod: 'auto_email',
          metadata: {},
        })
        .onConflictDoUpdate({
          target: [
            entityLinks.tenantId,
            entityLinks.linkType,
            entityLinks.canonicalKey,
            entityLinks.source,
            entityLinks.externalId,
          ],
          set: {
            displayName: candidate.displayName,
            email: candidate.email,
            updatedAt: new Date(),
          },
        });
      resolved += 1;
    }

    return resolved;
  });
}

export async function listEntityLinks(db: Database, tenantId: string, linkType?: 'owner' | 'customer_account' | 'project_mapping') {
  return withTenantContext(db, tenantId, async () => {
    return db
      .select()
      .from(entityLinks)
      .where(
        and(
          eq(entityLinks.tenantId, tenantId),
          isNull(entityLinks.deletedAt),
          linkType ? eq(entityLinks.linkType, linkType) : undefined,
        ),
      );
  });
}

export async function createManualEntityLink(
  db: Database,
  tenantId: string,
  input: {
    linkType: 'owner' | 'customer_account' | 'project_mapping';
    canonicalKey: string;
    email?: string | null;
    displayName?: string | null;
    source?: 'salesforce' | 'jira' | 'slack' | 'google_calendar' | null;
    externalId?: string | null;
    internalEntityId?: string | null;
    confidence?: number;
  },
) {
  return withTenantContext(db, tenantId, async () => {
    const [row] = await db
      .insert(entityLinks)
      .values({
        tenantId,
        linkType: input.linkType,
        canonicalKey: input.canonicalKey,
        email: input.email ?? null,
        displayName: input.displayName ?? null,
        source: input.source ?? null,
        externalId: input.externalId ?? input.canonicalKey,
        internalEntityId: input.internalEntityId ?? null,
        confidence: input.confidence ?? 100,
        resolutionMethod: 'manual',
      })
      .onConflictDoUpdate({
        target: [
          entityLinks.tenantId,
          entityLinks.linkType,
          entityLinks.canonicalKey,
          entityLinks.source,
          entityLinks.externalId,
        ],
        set: {
          email: input.email ?? null,
          displayName: input.displayName ?? null,
          confidence: input.confidence ?? 100,
          resolutionMethod: 'manual',
          updatedAt: new Date(),
        },
      })
      .returning();
    return row!;
  });
}

export async function syncProjectMappingEntityLinks(db: Database, tenantId: string): Promise<number> {
  return withTenantContext(db, tenantId, async () => {
    const mappings = await db
      .select()
      .from(integrationMappings)
      .where(
        and(
          eq(integrationMappings.tenantId, tenantId),
          eq(integrationMappings.mappingType, 'project_to_jira'),
          isNull(integrationMappings.deletedAt),
        ),
      );

    let count = 0;
    for (const mapping of mappings) {
      await db
        .insert(entityLinks)
        .values({
          tenantId,
          linkType: 'project_mapping',
          canonicalKey: `project:${mapping.internalId}`,
          source: 'jira',
          externalId: mapping.externalId,
          internalEntityId: mapping.internalId,
          confidence: 100,
          resolutionMethod: 'manual',
          metadata: mapping.metadata ?? {},
        })
        .onConflictDoUpdate({
          target: [
            entityLinks.tenantId,
            entityLinks.linkType,
            entityLinks.canonicalKey,
            entityLinks.source,
            entityLinks.externalId,
          ],
          set: {
            internalEntityId: mapping.internalId,
            metadata: mapping.metadata ?? {},
            updatedAt: new Date(),
          },
        });
      count += 1;
    }
    return count;
  });
}

export async function getUnlinkedProjects(db: Database, tenantId: string) {
  return withTenantContext(db, tenantId, async () => {
    const rows = await db
      .select({
        projectId: projects.id,
        projectName: projects.name,
        customerName: customers.name,
      })
      .from(projects)
      .innerJoin(customers, eq(projects.customerId, customers.id))
      .leftJoin(
        integrationMappings,
        and(
          eq(integrationMappings.internalId, projects.id),
          eq(integrationMappings.mappingType, 'project_to_jira'),
          isNull(integrationMappings.deletedAt),
        ),
      )
      .where(
        and(
          eq(projects.tenantId, tenantId),
          isNull(projects.deletedAt),
          sql`${integrationMappings.id} IS NULL`,
        ),
      );
    return rows;
  });
}
