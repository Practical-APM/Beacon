import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  closeDb,
  createDb,
  customers,
  projects,
  withTenantContext,
} from './index.js';
import { seedTenants } from './seed-helpers.js';
import { DATABASE_URL, isCiEnvironment, requireDatabaseHealth } from './test-support.js';

describe('RLS tenant isolation', () => {
  let tenantAId = '';
  let tenantBId = '';
  let dbAvailable = false;

  beforeAll(async () => {
    try {
      await requireDatabaseHealth();
      const seeded = await seedTenants(DATABASE_URL);
      tenantAId = seeded.find((tenant) => tenant.slug === 'acme-demo')?.id ?? '';
      tenantBId = seeded.find((tenant) => tenant.slug === 'globex-demo')?.id ?? '';
      dbAvailable = Boolean(tenantAId && tenantBId);
      if (!dbAvailable && isCiEnvironment()) {
        throw new Error('Expected seeded tenants acme-demo and globex-demo');
      }
    } catch (error) {
      if (isCiEnvironment()) throw error;
    } finally {
      await closeDb();
    }
  });

  afterAll(async () => {
    await closeDb();
  });

  it.skipIf(!dbAvailable)(
    'prevents tenant B from reading tenant A projects via RLS',
    async () => {
      const { db } = createDb(DATABASE_URL);
      const marker = `rls-isolation-${Date.now()}`;

      await withTenantContext(db, tenantAId, async () => {
        const [customer] = await db
          .insert(customers)
          .values({
            tenantId: tenantAId,
            name: `${marker}-customer`,
            externalId: `${marker}-customer`,
            externalSource: 'salesforce',
          })
          .returning();

        await db.insert(projects).values({
          tenantId: tenantAId,
          customerId: customer!.id,
          name: marker,
          status: 'active',
        });
      });

      const visibleInB = await withTenantContext(db, tenantBId, async () =>
        db.select().from(projects).where(eq(projects.name, marker)),
      );
      expect(visibleInB).toHaveLength(0);

      const visibleInA = await withTenantContext(db, tenantAId, async () =>
        db.select().from(projects).where(eq(projects.name, marker)),
      );
      expect(visibleInA).toHaveLength(1);

      await withTenantContext(db, tenantAId, async () => {
        await db.delete(projects).where(eq(projects.name, marker));
        await db.delete(customers).where(eq(customers.name, `${marker}-customer`));
      });

      await closeDb();
    },
  );
});
