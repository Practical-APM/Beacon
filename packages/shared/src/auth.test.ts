import { describe, expect, it } from 'vitest';
import {
  canManageMembers,
  canUpdateTenantSettings,
  hasMinimumRole,
  isValidRole,
} from './auth.js';

describe('RBAC helpers', () => {
  it('ranks roles correctly', () => {
    expect(hasMinimumRole('admin', 'contributor')).toBe(true);
    expect(hasMinimumRole('contributor', 'admin')).toBe(false);
    expect(hasMinimumRole('executive', 'operational')).toBe(true);
  });

  it('checks admin permissions', () => {
    expect(canManageMembers('admin')).toBe(true);
    expect(canManageMembers('contributor')).toBe(false);
    expect(canUpdateTenantSettings('admin')).toBe(true);
    expect(canUpdateTenantSettings('executive')).toBe(false);
  });

  it('validates role strings', () => {
    expect(isValidRole('admin')).toBe(true);
    expect(isValidRole('superuser')).toBe(false);
  });
});
