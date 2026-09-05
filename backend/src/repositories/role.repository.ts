import { NotFoundError } from '../errors';
import { mapPrismaError } from '../lib/prisma-error';
import type { DbClient } from './types';

export interface CreateRoleInput {
  name: string;
  description: string;
}

export class RoleRepository {
  constructor(private readonly db: DbClient) {}

  async create(input: CreateRoleInput) {
    try {
      return await this.db.role.create({
        data: {
          name: input.name.trim().toLowerCase(),
          description: input.description.trim(),
        },
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async findByName(name: string) {
    try {
      return await this.db.role.findUnique({
        where: { name: name.trim().toLowerCase() },
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async findByNameOrThrow(name: string) {
    const role = await this.findByName(name);
    if (!role) {
      throw new NotFoundError('Role not found');
    }
    return role;
  }

  async findByIdOrThrow(id: string) {
    try {
      const role = await this.db.role.findUnique({ where: { id } });
      if (!role) {
        throw new NotFoundError('Role not found');
      }
      return role;
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async list() {
    try {
      return await this.db.role.findMany({
        orderBy: { name: 'asc' },
        include: {
          rolePermissions: {
            include: { permission: true },
          },
        },
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async assignPermission(roleId: string, permissionId: string) {
    try {
      return await this.db.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId, permissionId },
        },
        update: {},
        create: { roleId, permissionId },
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async assignUser(userId: string, roleId: string) {
    try {
      return await this.db.userRole.upsert({
        where: {
          userId_roleId: { userId, roleId },
        },
        update: {},
        create: { userId, roleId },
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }
}
