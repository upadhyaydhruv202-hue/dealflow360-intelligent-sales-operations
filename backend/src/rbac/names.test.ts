import { describe, expect, it } from 'vitest';

import { isPermissionKey, isRoleName, normalizePermissionKey, normalizeRoleName } from './names';

describe('RBAC names', () => {
  it('normalizes role names case-insensitively', () => {
    expect(normalizeRoleName('ADMIN')).toBe('admin');
    expect(normalizeRoleName(' Staff ')).toBe('staff');
    expect(isRoleName('ADMIN')).toBe(true);
    expect(isRoleName('inventory_manager')).toBe(true);
    expect(isRoleName('A')).toBe(false);
  });

  it('accepts resource.action permission keys including future hackathon keys', () => {
    expect(normalizePermissionKey('Inventory.Approve')).toBe('inventory.approve');
    expect(isPermissionKey('users.read')).toBe(true);
    expect(isPermissionKey('inventory.approve')).toBe(true);
    expect(isPermissionKey('supplier.read')).toBe(true);
    expect(isPermissionKey('student.write')).toBe(true);
    expect(isPermissionKey('case.assign')).toBe(true);
    expect(isPermissionKey('admin.settings')).toBe(true);
    expect(isPermissionKey('users')).toBe(false);
    expect(isPermissionKey('Users.Read')).toBe(true);
  });
});
