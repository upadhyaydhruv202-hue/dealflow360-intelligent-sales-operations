import type { PrismaClient } from '@prisma/client';

import type { AuditService } from '../audit/audit.service';
import { AUDIT_ACTIONS } from '../constants';
import { ValidationError } from '../errors';
import { createRepositories } from '../repositories';
import { isPermissionKey, isRoleName, normalizePermissionKey, normalizeRoleName } from '../rbac/names';

export class RbacService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly audit?: AuditService | null,
  ) {}

  async listRoles() {
    const roles = await createRepositories(this.prisma).roles.list();
    return roles.map((role) => ({
      id: role.id,
      name: role.name,
      description: role.description,
      permissions: role.rolePermissions.map((entry) => entry.permission.key).sort(),
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    }));
  }

  async listPermissions() {
    return createRepositories(this.prisma).permissions.list();
  }

  async createRole(input: { name: string; description: string }) {
    const name = normalizeRoleName(input.name);
    if (!isRoleName(name)) {
      throw new ValidationError('Role names must be lowercase letters, digits, or underscores');
    }

    const role = await createRepositories(this.prisma).roles.create({
      name,
      description: input.description,
    });
    await this.audit?.record({
      action: AUDIT_ACTIONS.ROLE_CREATED,
      resource: 'role',
      resourceId: role.id,
      metadata: { name: role.name },
      status: 'succeeded',
    });
    return role;
  }

  async createPermission(input: { key: string; description: string }) {
    const key = normalizePermissionKey(input.key);
    if (!isPermissionKey(key)) {
      throw new ValidationError('Permission keys must use resource.action (for example inventory.approve)');
    }

    const permission = await createRepositories(this.prisma).permissions.create({
      key,
      description: input.description,
    });
    await this.audit?.record({
      action: AUDIT_ACTIONS.PERMISSION_CREATED,
      resource: 'permission',
      resourceId: permission.id,
      metadata: { key: permission.key },
      status: 'succeeded',
    });
    return permission;
  }

  async assignPermissionToRole(roleName: string, permissionKey: string) {
    const repos = createRepositories(this.prisma);
    const role = await repos.roles.findByNameOrThrow(normalizeRoleName(roleName));
    const permission = await repos.permissions.findByKeyOrThrow(normalizePermissionKey(permissionKey));

    await repos.roles.assignPermission(role.id, permission.id);
    await this.audit?.record({
      action: AUDIT_ACTIONS.ROLE_PERMISSION_ASSIGNED,
      resource: 'role',
      resourceId: role.id,
      metadata: { role: role.name, permission: permission.key },
      status: 'succeeded',
    });
    return {
      role: role.name,
      permission: permission.key,
    };
  }

  async assignRoleToUser(userId: string, roleName: string) {
    const repos = createRepositories(this.prisma);
    await repos.users.findByIdOrThrow(userId);
    const role = await repos.roles.findByNameOrThrow(normalizeRoleName(roleName));
    await repos.roles.assignUser(userId, role.id);

    const user = await repos.users.findByIdWithRoles(userId);
    await this.audit?.record({
      action: AUDIT_ACTIONS.USER_ROLE_ASSIGNED,
      resource: 'user',
      resourceId: userId,
      metadata: { role: role.name },
      status: 'succeeded',
    });
    return {
      userId,
      role: role.name,
      roles: user?.roles ?? [role.name],
      permissions: user?.permissions ?? [],
    };
  }
}
