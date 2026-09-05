import { describe, expect, it } from 'vitest';

import { ROLES } from './catalog';
import { mergeRbacCatalog } from './catalog-merge';

describe('mergeRbacCatalog', () => {
  it('keeps the platform catalog when no problem module is loaded', () => {
    const catalog = mergeRbacCatalog(null);
    expect(catalog.permissions.some((permission) => permission.key === 'users.read')).toBe(true);
    expect(catalog.rolePermissions[ROLES.ADMIN]).toContain('users.read');
  });

  it('adds problem permissions and grants them to admin', () => {
    const catalog = mergeRbacCatalog({
      permissions: [{ key: 'problem.sample.read', description: 'Read sample' }],
      rolePermissions: { staff: ['problem.sample.read'] },
    });

    expect(catalog.permissions.some((permission) => permission.key === 'problem.sample.read')).toBe(true);
    expect(catalog.rolePermissions[ROLES.ADMIN]).toContain('problem.sample.read');
    expect(catalog.rolePermissions[ROLES.STAFF]).toContain('problem.sample.read');
    expect(catalog.rolePermissions[ROLES.USER]).not.toContain('problem.sample.read');
  });

  it('adds finance and operations as distinct catalog roles', () => {
    const catalog = mergeRbacCatalog({
      permissions: [
        { key: 'dealflow.quotes.read', description: 'Read quotes' },
        { key: 'dealflow.billing.write', description: 'Bill' },
        { key: 'dealflow.fulfillment.write', description: 'Fulfill' },
      ],
      rolePermissions: {
        finance: ['dealflow.quotes.read', 'dealflow.billing.write'],
        operations: ['dealflow.quotes.read', 'dealflow.fulfillment.write'],
      },
    });

    expect(catalog.roles.some((role) => role.name === 'finance')).toBe(true);
    expect(catalog.roles.some((role) => role.name === 'operations')).toBe(true);
    expect(catalog.rolePermissions.finance).toContain('dealflow.billing.write');
    expect(catalog.rolePermissions.operations).toContain('dealflow.fulfillment.write');
    expect(catalog.rolePermissions.finance).not.toContain('dealflow.fulfillment.write');
    expect(catalog.rolePermissions.operations).not.toContain('dealflow.billing.write');
  });

  it('rejects colliding or invalid keys', () => {
    expect(() =>
      mergeRbacCatalog({
        permissions: [{ key: 'users.read', description: 'dup' }],
      }),
    ).toThrow(/collides/);
    expect(() =>
      mergeRbacCatalog({
        permissions: [{ key: 'not-a-key', description: 'bad' }],
      }),
    ).toThrow(/Invalid problem permission/);
  });
});
