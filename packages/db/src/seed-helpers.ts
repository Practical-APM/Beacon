import { and, eq } from 'drizzle-orm';
import { createDb, tenantMemberships, tenants, users } from './index.js';

export interface SeedUser {
  externalAuthId: string;
  email: string;
  name: string;
  role: 'executive' | 'operational' | 'contributor' | 'admin';
}

export interface SeedTenant {
  slug: string;
  name: string;
  users: SeedUser[];
}

export const SEED_TENANTS: SeedTenant[] = [
  {
    slug: 'acme-demo',
    name: 'Acme Demo Org',
    users: [
      {
        externalAuthId: 'admin-a',
        email: 'admin-a@acme-demo.test',
        name: 'Acme Admin',
        role: 'admin',
      },
      {
        externalAuthId: 'contributor-a',
        email: 'contributor-a@acme-demo.test',
        name: 'Acme Contributor',
        role: 'contributor',
      },
    ],
  },
  {
    slug: 'globex-demo',
    name: 'Globex Demo Org',
    users: [
      {
        externalAuthId: 'admin-b',
        email: 'admin-b@globex-demo.test',
        name: 'Globex Admin',
        role: 'admin',
      },
    ],
  },
];

export async function seedTenants(connectionString: string) {
  const { db } = createDb(connectionString);
  const seeded: Array<{ slug: string; id: string; users: Record<string, string> }> = [];

  for (const tenantSeed of SEED_TENANTS) {
    const existing = await db
      .select()
      .from(tenants)
      .where(eq(tenants.slug, tenantSeed.slug))
      .limit(1);

    let tenant = existing[0];
    if (!tenant) {
      const inserted = await db
        .insert(tenants)
        .values({ name: tenantSeed.name, slug: tenantSeed.slug })
        .returning();
      tenant = inserted[0];
    }

    if (!tenant) continue;

    const userMap: Record<string, string> = {};

    for (const userSeed of tenantSeed.users) {
      const existingUsers = await db
        .select()
        .from(users)
        .where(eq(users.externalAuthId, userSeed.externalAuthId))
        .limit(1);

      let user = existingUsers[0];
      if (!user) {
        const inserted = await db
          .insert(users)
          .values({
            externalAuthId: userSeed.externalAuthId,
            email: userSeed.email,
            name: userSeed.name,
          })
          .returning();
        user = inserted[0];
      } else if (user.email.endsWith('@dev.beacon.test') && user.email !== userSeed.email) {
        const [updated] = await db
          .update(users)
          .set({ email: userSeed.email, name: userSeed.name, updatedAt: new Date() })
          .where(eq(users.id, user.id))
          .returning();
        user = updated ?? user;
      } else if (user.email.endsWith('@anonymized.local')) {
        const [updated] = await db
          .update(users)
          .set({ email: userSeed.email, name: userSeed.name, updatedAt: new Date() })
          .where(eq(users.id, user.id))
          .returning();
        user = updated ?? user;
      }

      if (!user) continue;
      userMap[userSeed.externalAuthId] = user.id;

      const existingMembership = await db
        .select()
        .from(tenantMemberships)
        .where(
          and(
            eq(tenantMemberships.tenantId, tenant.id),
            eq(tenantMemberships.userId, user.id),
          ),
        )
        .limit(1);

      if (existingMembership.length === 0) {
        await db.insert(tenantMemberships).values({
          tenantId: tenant.id,
          userId: user.id,
          role: userSeed.role,
        });
      } else if (existingMembership[0]?.deletedAt) {
        await db
          .update(tenantMemberships)
          .set({
            deletedAt: null,
            role: userSeed.role,
            updatedAt: new Date(),
          })
          .where(eq(tenantMemberships.id, existingMembership[0].id));
      }
    }

    seeded.push({ slug: tenant.slug, id: tenant.id, users: userMap });
  }

  return seeded;
}
