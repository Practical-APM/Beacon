import { createDb } from '@beacon/db';
import { isValidRole } from '@beacon/shared/auth';
import type { Context } from 'hono';
import { Hono } from 'hono';
import { z } from 'zod';
import { env } from '../../env.js';
import { ApiError, badRequest, problemResponse } from '../../lib/errors.js';
import { bearerToken, verifyAccessToken } from '../../lib/auth.js';
import { getAuth, getUserId, requireAuth, requireUser } from '../../middleware/auth.js';
import { requireAdmin, requireRole } from '../../middleware/rbac.js';
import {
  createInvitation,
  createTenantWithAdmin,
  getMembershipsForUser,
  getTenantForMember,
  listInvitations,
  listTenantMembers,
  revokeMembership,
  updateTenantName,
  upsertUser,
} from '../../services/tenant-service.js';

const createTenantSchema = z.object({
  name: z.string().min(2).max(120),
});

const updateTenantSchema = z.object({
  name: z.string().min(2).max(120),
});

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['executive', 'operational', 'contributor', 'admin']).default('contributor'),
});

function requireParam(c: Context, key: string): string {
  const value = c.req.param(key);
  if (!value) {
    throw badRequest(`Missing route parameter: ${key}`);
  }
  return value;
}

export const tenantRoutes = new Hono();

tenantRoutes.post('/tenants', async (c) => {
  const token = bearerToken(c.req.header('Authorization'));
  if (!token) {
    return problemResponse(c, badRequest('Authorization header required'));
  }

  const body = createTenantSchema.safeParse(await c.req.json());
  if (!body.success) {
    return problemResponse(c, badRequest(body.error.message));
  }

  const identity = await verifyAccessToken(token);
  const { db } = createDb(env.DATABASE_URL);
  const user = await upsertUser(db, identity);
  const tenant = await createTenantWithAdmin(db, {
    name: body.data.name,
    adminUserId: user.id,
  });

  const memberships = await getMembershipsForUser(db, user.id);
  return c.json({ tenant, memberships }, 201);
});

tenantRoutes.get('/tenants', requireUser, async (c) => {
  const userId = getUserId(c);
  const { db } = createDb(env.DATABASE_URL);
  const memberships = await getMembershipsForUser(db, userId);
  return c.json({ memberships });
});

tenantRoutes.get('/tenants/:tenantId', requireAuth, async (c) => {
  try {
    const auth = getAuth(c);
    const tenantId = requireParam(c, 'tenantId');
    const { db } = createDb(env.DATABASE_URL);
    const { tenant, role } = await getTenantForMember(db, tenantId, auth.userId);
    return c.json({ tenant, role });
  } catch (error) {
    if (error instanceof ApiError) {
      return problemResponse(c, error);
    }
    throw error;
  }
});

tenantRoutes.patch('/tenants/:tenantId', requireAuth, requireAdmin(), async (c) => {
  const auth = getAuth(c);
  const tenantId = requireParam(c, 'tenantId');
  const body = updateTenantSchema.safeParse(await c.req.json());
  if (!body.success) {
    return problemResponse(c, badRequest(body.error.message));
  }

  const { db } = createDb(env.DATABASE_URL);
  await getTenantForMember(db, tenantId, auth.userId);
  const tenant = await updateTenantName(db, tenantId, body.data.name, auth);
  return c.json({ tenant });
});

tenantRoutes.get('/tenants/:tenantId/members', requireAuth, requireRole('operational'), async (c) => {
  const auth = getAuth(c);
  const tenantId = requireParam(c, 'tenantId');
  const { db } = createDb(env.DATABASE_URL);
  await getTenantForMember(db, tenantId, auth.userId);
  const members = await listTenantMembers(db, tenantId);
  return c.json({ members });
});

tenantRoutes.delete(
  '/tenants/:tenantId/members/:userId',
  requireAuth,
  requireAdmin(),
  async (c) => {
    const auth = getAuth(c);
    const tenantId = requireParam(c, 'tenantId');
    const userId = requireParam(c, 'userId');
    const { db } = createDb(env.DATABASE_URL);
    await getTenantForMember(db, tenantId, auth.userId);
    await revokeMembership(db, tenantId, userId, auth);
    return c.body(null, 204);
  },
);

tenantRoutes.get('/tenants/:tenantId/invitations', requireAuth, requireAdmin(), async (c) => {
  const auth = getAuth(c);
  const tenantId = requireParam(c, 'tenantId');
  const { db } = createDb(env.DATABASE_URL);
  await getTenantForMember(db, tenantId, auth.userId);
  const pending = await listInvitations(db, tenantId);
  return c.json({ invitations: pending });
});

tenantRoutes.post('/tenants/:tenantId/invitations', requireAuth, requireAdmin(), async (c) => {
  const auth = getAuth(c);
  const tenantId = requireParam(c, 'tenantId');
  const body = inviteSchema.safeParse(await c.req.json());
  if (!body.success) {
    return problemResponse(c, badRequest(body.error.message));
  }
  if (!isValidRole(body.data.role)) {
    return problemResponse(c, badRequest('Invalid role'));
  }

  const { db } = createDb(env.DATABASE_URL);
  await getTenantForMember(db, tenantId, auth.userId);
  const invitation = await createInvitation(db, {
    tenantId,
    email: body.data.email,
    role: body.data.role,
    invitedByUserId: auth.userId,
  });

  return c.json({ invitation }, 201);
});
