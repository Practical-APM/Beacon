import type { AuthContext } from '@beacon/shared/auth';
import type { Context, Next } from 'hono';
import { createDb } from '@beacon/db';
import { getTenantId, TENANT_ID_HEADER } from '@beacon/shared';
import { env } from '../env.js';
import { bearerToken, toAuthContext, verifyAccessToken } from '../lib/auth.js';
import { ApiError, badRequest, problemResponse, unauthorized } from '../lib/errors.js';
import { resolveMembership, upsertUser } from '../services/tenant-service.js';

const PUBLIC_PATHS = new Set(['/', '/health', '/ready']);

function isPublicPath(path: string): boolean {
  return PUBLIC_PATHS.has(path);
}

function isSalesforceCallback(path: string): boolean {
  return path === '/v1/integrations/salesforce/callback';
}

function isJiraCallback(path: string): boolean {
  return path === '/v1/integrations/jira/callback';
}

function isWebhookPath(path: string): boolean {
  return path.startsWith('/v1/webhooks');
}

function isNotificationUnsubscribe(path: string): boolean {
  return path === '/v1/notifications/unsubscribe';
}

function isPublicLegalPath(path: string): boolean {
  return path === '/v1/legal/dpa';
}

function isGoogleCalendarCallback(path: string): boolean {
  return path === '/v1/integrations/google-calendar/callback';
}

export async function authenticate(c: Context, next: Next): Promise<Response | void> {
  if (
    isPublicPath(c.req.path) ||
    isWebhookPath(c.req.path) ||
    isNotificationUnsubscribe(c.req.path) ||
    isPublicLegalPath(c.req.path) ||
    isSalesforceCallback(c.req.path) ||
    isJiraCallback(c.req.path) ||
    isGoogleCalendarCallback(c.req.path)
  ) {
    c.set('auth', null);
    c.set('userId', null);
    await next();
    return;
  }

  try {
    const token = bearerToken(c.req.header('Authorization'));
    if (!token) {
      throw unauthorized();
    }

    const identity = await verifyAccessToken(token);
    const { db } = createDb(env.DATABASE_URL);
    const user = await upsertUser(db, identity);
    c.set('userId', user.id);

    const resolvedIdentity = {
      ...identity,
      email: user.email,
      name: user.name ?? identity.name,
    };

    const headerTenantId = getTenantId(c.req.raw.headers);
    if (headerTenantId) {
      const membership = await resolveMembership(db, user.id, headerTenantId);
      if (!membership) {
        throw new ApiError(
          403,
          'Forbidden',
          'You are not a member of the selected organization',
        );
      }

      c.set(
        'auth',
        toAuthContext(resolvedIdentity, {
          userId: user.id,
          tenantId: headerTenantId,
          role: membership.role,
        }),
      );
      c.set('tenantId', headerTenantId);
      c.header(TENANT_ID_HEADER, headerTenantId);
    } else {
      c.set('auth', null);
    }

    await next();
  } catch (error) {
    if (error instanceof ApiError) {
      return problemResponse(c, error);
    }
    throw error;
  }
}

export function requireUser(c: Context, next: Next): Promise<void | Response> {
  if (!c.get('userId')) {
    return Promise.resolve(problemResponse(c, unauthorized()));
  }
  return next();
}

export function requireAuth(c: Context, next: Next): Promise<void | Response> {
  const auth = c.get('auth') as AuthContext | null;
  if (!auth) {
    if (!c.get('userId')) {
      return Promise.resolve(problemResponse(c, unauthorized()));
    }
    return Promise.resolve(
      problemResponse(
        c,
        badRequest(`${TENANT_ID_HEADER} header is required for this endpoint`),
      ),
    );
  }
  return next();
}

export function getAuth(c: Context): AuthContext {
  const auth = c.get('auth') as AuthContext | null;
  if (!auth) {
    throw unauthorized();
  }
  return auth;
}

export function getUserId(c: Context): string {
  const userId = c.get('userId') as string | null;
  if (!userId) {
    throw unauthorized();
  }
  return userId;
}
