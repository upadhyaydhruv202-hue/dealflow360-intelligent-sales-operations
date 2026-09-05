import { describe, expect, it } from 'vitest';

import { canAccessInternalDealflow, hasPermission, hasRole, homePathForUser } from './rbac';

describe('frontend RBAC helpers (UX only)', () => {
  const user = {
    roles: ['user', 'staff'],
    permissions: ['notifications.read', 'odoo.read'],
  };

  it('hides privileged UI when the permission is missing', () => {
    expect(hasPermission(user, 'odoo.read')).toBe(true);
    expect(hasPermission(user, 'odoo.write')).toBe(false);
    expect(hasRole(user, 'ADMIN')).toBe(false);
    expect(hasRole(user, 'STAFF')).toBe(true);
  });

  it('sends customer accounts to /account and staff to /dealflow', () => {
    expect(homePathForUser({ roles: ['user'], permissions: [] })).toBe('/account');
    expect(canAccessInternalDealflow({ roles: ['user'], permissions: [] })).toBe(false);
    expect(homePathForUser({ roles: ['staff'], permissions: [] })).toBe('/dealflow');
    expect(homePathForUser({ roles: ['user'], permissions: ['dealflow.quotes.read'] })).toBe('/dealflow');
  });
});
