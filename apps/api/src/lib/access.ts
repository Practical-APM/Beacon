import type { AuthContext } from '@beacon/shared/auth';
import { hasMinimumRole } from '@beacon/shared/auth';
import { sql, type SQL } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';

export function projectAccessFilter(
  auth: AuthContext,
  ownerEmailColumn: PgColumn,
): SQL | undefined {
  if (hasMinimumRole(auth.role, 'operational')) {
    return undefined;
  }

  return sql`lower(${ownerEmailColumn}) = ${auth.email.toLowerCase()}`;
}

export function assertProjectAccess(
  auth: AuthContext,
  project: { ownerEmail: string | null },
): boolean {
  if (hasMinimumRole(auth.role, 'operational')) {
    return true;
  }
  if (!project.ownerEmail) {
    return false;
  }
  return project.ownerEmail.toLowerCase() === auth.email.toLowerCase();
}
