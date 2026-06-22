import type { UserRole } from '@beacon/shared/auth';
import { hasMinimumRole } from '@beacon/shared/auth';
import type { Context, Next } from 'hono';
import { ApiError, forbidden, problemResponse, unauthorized } from '../lib/errors.js';
import { getAuth } from './auth.js';

export function requireRole(minimumRole: UserRole) {
  return async (c: Context, next: Next): Promise<Response | void> => {
    try {
      const auth = getAuth(c);
      if (!hasMinimumRole(auth.role, minimumRole)) {
        return problemResponse(c, forbidden(`Requires ${minimumRole} role or higher`));
      }
      await next();
    } catch (error) {
      if (error instanceof ApiError) {
        return problemResponse(c, error);
      }
      return problemResponse(c, unauthorized());
    }
  };
}

export function requireAdmin() {
  return requireRole('admin');
}
