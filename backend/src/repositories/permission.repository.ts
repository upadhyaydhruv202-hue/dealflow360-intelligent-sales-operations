import { NotFoundError } from '../errors';
import { mapPrismaError } from '../lib/prisma-error';
import type { DbClient } from './types';

export interface CreatePermissionInput {
  key: string;
  description: string;
}

export class PermissionRepository {
  constructor(private readonly db: DbClient) {}

  async create(input: CreatePermissionInput) {
    try {
      return await this.db.permission.create({
        data: {
          key: input.key.trim().toLowerCase(),
          description: input.description.trim(),
        },
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async findByKey(key: string) {
    try {
      return await this.db.permission.findUnique({
        where: { key: key.trim().toLowerCase() },
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async findByKeyOrThrow(key: string) {
    const permission = await this.findByKey(key);
    if (!permission) {
      throw new NotFoundError('Permission not found');
    }
    return permission;
  }

  async findByIdOrThrow(id: string) {
    try {
      const permission = await this.db.permission.findUnique({ where: { id } });
      if (!permission) {
        throw new NotFoundError('Permission not found');
      }
      return permission;
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async list() {
    try {
      return await this.db.permission.findMany({
        orderBy: { key: 'asc' },
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }
}
