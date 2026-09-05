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
