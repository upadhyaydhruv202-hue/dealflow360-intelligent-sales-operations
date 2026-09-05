import { ROLES, DEFAULT_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS, DEFAULT_ROLES } from './catalog';
import { isPermissionKey, normalizePermissionKey, normalizeRoleName } from './names';
import type { ProblemModule, ProblemPermission } from '../problem/types';

export interface MergedRbacCatalog {
  roles: Array<{ name: string; description: string }>;
  permissions: Array<{ key: string; description: string }>;
  rolePermissions: Record<string, readonly string[]>;
}

export function mergeRbacCatalog(module?: Pick<ProblemModule, 'permissions' | 'rolePermissions'> | null): MergedRbacCatalog {
  const permissions: Array<{ key: string; description: string }> = DEFAULT_PERMISSIONS.map((permission) => ({
    key: permission.key,
    description: permission.description,
  }));
  const seen = new Set(permissions.map((permission) => permission.key));

  for (const permission of module?.permissions ?? []) {
    const key = normalizePermissionKey(permission.key);
    if (!isPermissionKey(key)) {
      throw new Error(`Invalid problem permission key: ${permission.key}`);
    }
    if (seen.has(key)) {
      throw new Error(`Problem permission collides with the platform catalog: ${key}`);
    }
    seen.add(key);
    permissions.push({ key, description: permission.description });
  }

  const rolePermissions: Record<string, string[]> = Object.fromEntries(
    Object.entries(DEFAULT_ROLE_PERMISSIONS).map(([role, keys]) => [role, [...keys]]),
  );

  for (const [role, keys] of Object.entries(module?.rolePermissions ?? {})) {
    const name = normalizeRoleName(role);
    const next = rolePermissions[name] ?? [];
    for (const key of keys) {
      const normalized = normalizePermissionKey(key);
      if (!next.includes(normalized)) {
        next.push(normalized);
      }
    }
    rolePermissions[name] = next;
  }

  rolePermissions[ROLES.ADMIN] = permissions.map((permission) => permission.key);

  const extraRoles = Object.keys(rolePermissions)
    .filter((name) => !DEFAULT_ROLES.some((role) => role.name === name))
    .map((name) => ({
      name,
      description:
        name === 'finance'
          ? 'Billing, financial approvals, and commercial reporting'
          : name === 'operations'
            ? 'Warehouses, inventory, fulfillment, and backorders'
            : `Application role: ${name}`,
    }));

  return { roles: [...DEFAULT_ROLES, ...extraRoles], permissions, rolePermissions };
}

export function describeProblemPermissions(module?: Pick<ProblemModule, 'permissions'> | null): ProblemPermission[] {
  return [...(module?.permissions ?? [])];
}
