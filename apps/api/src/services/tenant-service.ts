import {
  invitations,
  tenantMemberships,
  tenants,
  users,
  withTenantContext,
  type Database,
} from '@beacon/db';
import { SEED_TENANTS } from '@beacon/db/seed-helpers';
import type { AuthContext, MeResponse, TenantMembershipSummary, UserRole } from '@beacon/shared/auth';
import { isDpaAcceptanceCurrent } from '@beacon/shared/legal';
import { isValidRole } from '@beacon/shared/auth';
import { and, eq, isNull } from 'drizzle-orm';
import { conflict, forbidden, notFound } from '../lib/errors.js';
import type { VerifiedIdentity } from '../lib/auth.js';

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

const DEV_SYNTHETIC_EMAIL_SUFFIX = '@dev.beacon.test';

function isDevSyntheticEmail(email: string): boolean {
  return email.endsWith(DEV_SYNTHETIC_EMAIL_SUFFIX);
}

function resolveSeedEmail(externalAuthId: string): string | null {
  for (const tenant of SEED_TENANTS) {
    const match = tenant.users.find((user) => user.externalAuthId === externalAuthId);
    if (match) return match.email;
  }
  return null;
}

export function resolveSeedEmailForDevAuth(externalAuthId: string): string | null {
  return resolveSeedEmail(externalAuthId);
}

function resolveDevUserEmail(identity: VerifiedIdentity, existingEmail?: string | null): string {
  const seedEmail = resolveSeedEmail(identity.externalAuthId);
  if (seedEmail && isDevSyntheticEmail(identity.email)) {
    return seedEmail;
  }
  if (existingEmail && isDevSyntheticEmail(identity.email)) {
    return existingEmail;
  }
  return identity.email;
}

export async function upsertUser(db: Database, identity: VerifiedIdentity) {
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.externalAuthId, identity.externalAuthId))
    .limit(1);

  if (existing[0]) {
    const [updated] = await db
      .update(users)
      .set({
        email: resolveDevUserEmail(identity, existing[0].email),
        name: identity.name ?? existing[0].name,
        updatedAt: new Date(),
      })
      .where(eq(users.id, existing[0].id))
      .returning();
    return updated!;
  }

  const [created] = await db
    .insert(users)
    .values({
      externalAuthId: identity.externalAuthId,
      email: resolveDevUserEmail(identity),
      name: identity.name,
    })
    .returning();

  return created!;
}

export async function updateUserLocale(db: Database, userId: string, locale: string) {
  const { normalizeLocale } = await import('@beacon/shared/i18n');
  const nextLocale = normalizeLocale(locale);
  const [row] = await db
    .update(users)
    .set({ locale: nextLocale, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning();
  if (!row) throw notFound('User not found');
  return row;
}

export async function updateUserCurrencyFormatLocale(
  db: Database,
  userId: string,
  currencyFormatLocale: string,
) {
  const { normalizeCurrencyFormatLocale } = await import('@beacon/shared/currency-format');
  const nextLocale = normalizeCurrencyFormatLocale(currencyFormatLocale);
  const [row] = await db
    .update(users)
    .set({ currencyFormatLocale: nextLocale, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning();
  if (!row) throw notFound('User not found');
  return row;
}

export async function getMembershipsForUser(
  db: Database,
  userId: string,
): Promise<TenantMembershipSummary[]> {
  const rows = await db
    .select({
      tenantId: tenants.id,
      tenantName: tenants.name,
      tenantSlug: tenants.slug,
      role: tenantMemberships.role,
    })
    .from(tenantMemberships)
    .innerJoin(tenants, eq(tenantMemberships.tenantId, tenants.id))
    .where(and(eq(tenantMemberships.userId, userId), isNull(tenantMemberships.deletedAt)));

  return rows.map((row) => ({
    tenantId: row.tenantId,
    tenantName: row.tenantName,
    tenantSlug: row.tenantSlug,
    role: row.role,
  }));
}

export async function resolveMembership(
  db: Database,
  userId: string,
  tenantId: string,
): Promise<{ role: UserRole } | null> {
  const [membership] = await db
    .select({ role: tenantMemberships.role })
    .from(tenantMemberships)
    .where(
      and(
        eq(tenantMemberships.userId, userId),
        eq(tenantMemberships.tenantId, tenantId),
        isNull(tenantMemberships.deletedAt),
      ),
    )
    .limit(1);

  return membership ?? null;
}

export async function buildMeResponse(
  db: Database,
  user: Awaited<ReturnType<typeof upsertUser>>,
  activeTenantId: string | null,
): Promise<MeResponse> {
  const memberships = await getMembershipsForUser(db, user.id);
  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      externalAuthId: user.externalAuthId,
      dpaAcceptedAt: user.dpaAcceptedAt?.toISOString() ?? null,
      dpaVersion: user.dpaVersion ?? null,
      dpaCurrent: isDpaAcceptanceCurrent(user.dpaVersion, user.dpaAcceptedAt),
      locale: user.locale ?? 'en',
      currencyFormatLocale: user.currencyFormatLocale ?? 'en-US',
    },
    activeTenantId,
    memberships,
  };
}

export async function createTenantWithAdmin(
  db: Database,
  params: {
    name: string;
    externalOrgId?: string | null;
    adminUserId: string;
  },
) {
  const baseSlug = slugify(params.name) || 'organization';
  let slug = baseSlug;
  let attempt = 0;

  while (attempt < 5) {
    const existing = await db.select().from(tenants).where(eq(tenants.slug, slug)).limit(1);
    if (!existing[0]) break;
    attempt += 1;
    slug = `${baseSlug}-${attempt}`;
  }

  const [tenant] = await db
    .insert(tenants)
    .values({
      name: params.name,
      slug,
      externalOrgId: params.externalOrgId ?? null,
    })
    .returning();

  await db.insert(tenantMemberships).values({
    tenantId: tenant!.id,
    userId: params.adminUserId,
    role: 'admin',
  });

  return tenant!;
}

export async function getTenantForMember(db: Database, tenantId: string, userId: string) {
  const membership = await resolveMembership(db, userId, tenantId);
  if (!membership) {
    throw forbidden('You are not a member of this organization');
  }

  const [tenant] = await db
    .select()
    .from(tenants)
    .where(and(eq(tenants.id, tenantId), isNull(tenants.deletedAt)))
    .limit(1);

  if (!tenant) {
    throw notFound('Organization not found');
  }

  return { tenant, role: membership.role };
}

export async function updateTenantName(
  db: Database,
  tenantId: string,
  name: string,
  auth: AuthContext,
) {
  if (auth.role !== 'admin') {
    throw forbidden('Only admins can update organization settings');
  }

  return withTenantContext(db, tenantId, async () => {
    const [updated] = await db
      .update(tenants)
      .set({ name, updatedAt: new Date() })
      .where(eq(tenants.id, tenantId))
      .returning();
    return updated!;
  });
}

export async function listTenantMembers(db: Database, tenantId: string) {
  return withTenantContext(db, tenantId, async () =>
    db
      .select({
        userId: users.id,
        email: users.email,
        name: users.name,
        role: tenantMemberships.role,
        joinedAt: tenantMemberships.createdAt,
      })
      .from(tenantMemberships)
      .innerJoin(users, eq(tenantMemberships.userId, users.id))
      .where(
        and(eq(tenantMemberships.tenantId, tenantId), isNull(tenantMemberships.deletedAt)),
      ),
  );
}

export async function createInvitation(
  db: Database,
  params: {
    tenantId: string;
    email: string;
    role: UserRole;
    invitedByUserId: string;
  },
) {
  if (!isValidRole(params.role)) {
    throw conflict('Invalid role');
  }

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  return withTenantContext(db, params.tenantId, async () => {
    const [invitation] = await db
      .insert(invitations)
      .values({
        tenantId: params.tenantId,
        email: params.email.toLowerCase(),
        role: params.role,
        invitedByUserId: params.invitedByUserId,
        token,
        expiresAt,
      })
      .returning();

    return invitation!;
  });
}

export async function listInvitations(db: Database, tenantId: string) {
  return withTenantContext(db, tenantId, async () =>
    db
      .select()
      .from(invitations)
      .where(and(eq(invitations.tenantId, tenantId), eq(invitations.status, 'pending'))),
  );
}

export async function syncClerkOrganization(
  db: Database,
  params: {
    externalOrgId: string;
    name: string;
    adminExternalAuthId: string;
    adminEmail: string;
    adminName?: string | null;
  },
) {
  const adminUser = await upsertUser(db, {
    externalAuthId: params.adminExternalAuthId,
    email: params.adminEmail,
    name: params.adminName ?? null,
  });

  const existing = await db
    .select()
    .from(tenants)
    .where(eq(tenants.externalOrgId, params.externalOrgId))
    .limit(1);

  if (existing[0]) {
    return existing[0];
  }

  return createTenantWithAdmin(db, {
    name: params.name,
    externalOrgId: params.externalOrgId,
    adminUserId: adminUser.id,
  });
}

export async function syncClerkMembership(
  db: Database,
  params: {
    externalOrgId: string;
    externalAuthId: string;
    email: string;
    name?: string | null;
    role?: UserRole;
  },
) {
  const user = await upsertUser(db, {
    externalAuthId: params.externalAuthId,
    email: params.email,
    name: params.name ?? null,
  });

  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.externalOrgId, params.externalOrgId))
    .limit(1);

  if (!tenant) {
    return null;
  }

  const role = params.role ?? 'contributor';
  const existing = await resolveMembership(db, user.id, tenant.id);
  if (existing) {
    return existing;
  }

  await db.insert(tenantMemberships).values({
    tenantId: tenant.id,
    userId: user.id,
    role,
  });

  return { role };
}

export async function revokeMembership(
  db: Database,
  tenantId: string,
  userId: string,
  actor: AuthContext,
) {
  if (actor.role !== 'admin') {
    throw forbidden('Only admins can remove members');
  }
  if (actor.userId === userId) {
    throw conflict('Admins cannot remove themselves');
  }

  await withTenantContext(db, tenantId, async () => {
    await db
      .update(tenantMemberships)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(tenantMemberships.tenantId, tenantId),
          eq(tenantMemberships.userId, userId),
          isNull(tenantMemberships.deletedAt),
        ),
      );
  });
}
