import { USER_ROLES, type UserRole } from './constants.js';

export type { UserRole };

const ROLE_RANK: Record<UserRole, number> = {
  contributor: 1,
  operational: 2,
  executive: 3,
  admin: 4,
};

export function hasMinimumRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_RANK[userRole] >= ROLE_RANK[requiredRole];
}

export function assertRole(userRole: UserRole, allowedRoles: UserRole[]): boolean {
  return allowedRoles.some(
    (role) => userRole === role || (role !== 'admin' && hasMinimumRole(userRole, role)),
  );
}

export function canManageMembers(role: UserRole): boolean {
  return hasMinimumRole(role, 'admin');
}

export function canViewMembers(role: UserRole): boolean {
  return hasMinimumRole(role, 'operational');
}

export function canUpdateTenantSettings(role: UserRole): boolean {
  return hasMinimumRole(role, 'admin');
}

export function isValidRole(value: string): value is UserRole {
  return (USER_ROLES as readonly string[]).includes(value);
}

export interface AuthContext {
  userId: string;
  externalAuthId: string;
  email: string;
  name: string | null;
  tenantId: string;
  role: UserRole;
}

export interface TenantMembershipSummary {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  role: UserRole;
}

export interface MeResponse {
  user: {
    id: string;
    email: string;
    name: string | null;
    externalAuthId: string;
    dpaAcceptedAt: string | null;
    dpaVersion: string | null;
    dpaCurrent: boolean;
    locale: string;
    currencyFormatLocale: string;
  };
  activeTenantId: string | null;
  memberships: TenantMembershipSummary[];
}
