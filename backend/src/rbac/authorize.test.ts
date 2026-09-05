import { describe, expect, it } from 'vitest';

import type { AuthenticatedUser } from '../auth/types';
import { AuthenticationError, AuthorizationError } from '../errors';
import {
  assertPermission,
  assertRole,
  hasAnyPermission,
  hasPermission,
  hasRole,
} from './authorize';
import { DEFAULT_ROLE_PERMISSIONS, PERMISSIONS, ROLES } from './catalog';

function user(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'user@example.com',
    displayName: 'Test',
    status: 'active',
    role: ROLES.USER,
    roles: [ROLES.USER],
    permissions: [...DEFAULT_ROLE_PERMISSIONS[ROLES.USER]],
    ...overrides,
  };
}

describe('RBAC authorize helpers', () => {
  it('matches roles case-insensitively', () => {
    const admin = user({ role: ROLES.ADMIN, roles: [ROLES.ADMIN], permissions: [] });
    expect(hasRole(admin, 'ADMIN')).toBe(true);
    expect(hasRole(admin, ROLES.MANAGER)).toBe(false);
  });

  it('requires every listed permission and supports a union across roles', () => {
    const staffAndUser = user({
      roles: [ROLES.USER, ROLES.STAFF],
      permissions: [PERMISSIONS.NOTIFICATIONS_READ, PERMISSIONS.ODOO_READ],
    });

    expect(hasPermission(staffAndUser, PERMISSIONS.NOTIFICATIONS_READ)).toBe(true);
    expect(hasPermission(staffAndUser, PERMISSIONS.ODOO_READ)).toBe(true);
    expect(hasPermission(staffAndUser, PERMISSIONS.ODOO_WRITE)).toBe(false);
    expect(hasPermission(staffAndUser, PERMISSIONS.NOTIFICATIONS_READ, PERMISSIONS.ODOO_READ)).toBe(true);
    expect(hasAnyPermission(staffAndUser, PERMISSIONS.ODOO_WRITE, PERMISSIONS.ODOO_READ)).toBe(true);
  });

  it('does not treat ADMIN as a permission bypass', () => {
    const admin = user({
      role: ROLES.ADMIN,
      roles: [ROLES.ADMIN],
      permissions: [PERMISSIONS.USERS_READ],
    });

    expect(hasPermission(admin, 'inventory.approve')).toBe(false);
    expect(() => assertPermission(admin, 'inventory.approve')).toThrow(AuthorizationError);
  });

  it('rejects unauthenticated callers before checking roles', () => {
    expect(() => assertRole(undefined, 'ADMIN')).toThrow(AuthenticationError);
    expect(() => assertPermission(undefined, 'users.read')).toThrow(AuthenticationError);
  });

  it('keeps Odoo writes independent from application login', () => {
    const appUser = user();
    expect(hasRole(appUser, 'USER')).toBe(true);
    expect(hasPermission(appUser, PERMISSIONS.ODOO_READ)).toBe(false);
    expect(hasPermission(appUser, PERMISSIONS.ODOO_WRITE)).toBe(false);
  });
});
