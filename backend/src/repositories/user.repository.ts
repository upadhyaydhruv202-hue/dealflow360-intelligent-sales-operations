import type { Prisma, UserStatus } from '@prisma/client';

import { NotFoundError } from '../errors';
import { mapPrismaError } from '../lib/prisma-error';
import {
  parseFilters,
  parsePagination,
  parseSort,
  toPaginatedResult,
  toPrismaOrderBy,
  toPrismaWhere,
  type FilterCatalog,
  type FilterRule,
  type PaginatedResult,
  type PaginationInput,
  type SortInput,
} from './query';
import { publicUserSelect, type DbClient, type PublicUser, type UserWithRoles } from './types';

export const USER_SORT_FIELDS = ['createdAt', 'updatedAt', 'email', 'displayName'] as const;
export type UserSortField = (typeof USER_SORT_FIELDS)[number];

export const USER_FILTER_CATALOG = {
  email: { operators: ['eq', 'contains'], type: 'string' },
  status: { operators: ['eq', 'in'], type: 'enum', enumValues: ['active', 'invited', 'disabled'] },
  createdAt: { operators: ['gte', 'lte'], type: 'date' },
} as const satisfies FilterCatalog;

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  displayName: string;
  status?: UserStatus;
}

export interface UpdateUserInput {
  displayName?: string;
  status?: UserStatus;
  passwordHash?: string;
}

export interface UserListInput extends PaginationInput, SortInput {
  filters?: FilterRule[];
}

export interface UserAuthRecord extends PublicUser {
  passwordHash: string;
}

export class UserRepository {
  constructor(private readonly db: DbClient) {}

  async create(input: CreateUserInput): Promise<PublicUser> {
    try {
      return await this.db.user.create({
        data: {
          email: normalizeEmail(input.email),
          passwordHash: input.passwordHash,
          displayName: input.displayName.trim(),
          status: input.status ?? 'active',
        },
        select: publicUserSelect,
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async findById(id: string): Promise<PublicUser | null> {
    try {
      return await this.db.user.findUnique({
        where: { id },
        select: publicUserSelect,
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async findByIdOrThrow(id: string): Promise<PublicUser> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    return user;
  }

  async findByIdWithRoles(id: string): Promise<UserWithRoles | null> {
    try {
      const user = await this.db.user.findUnique({
        where: { id },
        select: {
          ...publicUserSelect,
          userRoles: {
            select: {
              role: {
                select: {
                  name: true,
                  rolePermissions: {
                    select: {
                      permission: { select: { key: true } },
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!user) {
        return null;
      }

      return mapUserWithRoles(user);
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async findByEmailForAuth(email: string): Promise<UserAuthRecord | null> {
    try {
      return await this.db.user.findUnique({
        where: { email: normalizeEmail(email) },
        select: {
          ...publicUserSelect,
          passwordHash: true,
        },
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async list(input: UserListInput = {}): Promise<PaginatedResult<PublicUser>> {
    const pagination = parsePagination(input);
    const sort = parseSort(input, USER_SORT_FIELDS, 'createdAt', 'desc');
    const where = toPrismaWhere(parseFilters(input.filters, USER_FILTER_CATALOG)) as Prisma.UserWhereInput;

    try {
      const [items, totalItems] = await Promise.all([
        this.db.user.findMany({
          where,
          orderBy: toPrismaOrderBy(sort),
          skip: pagination.skip,
          take: pagination.take,
          select: publicUserSelect,
        }),
        this.db.user.count({ where }),
      ]);

      return toPaginatedResult(items, pagination, totalItems);
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async update(id: string, input: UpdateUserInput): Promise<PublicUser> {
    try {
      return await this.db.user.update({
        where: { id },
        data: {
          displayName: input.displayName?.trim(),
          status: input.status,
          passwordHash: input.passwordHash,
        },
        select: publicUserSelect,
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }
}

function mapUserWithRoles(
  user: PublicUser & {
    userRoles: {
      role: {
        name: string;
        rolePermissions: { permission: { key: string } }[];
      };
    }[];
  },
): UserWithRoles {
  const roles = [...new Set(user.userRoles.map((entry) => entry.role.name))].sort();
  const permissions = [
    ...new Set(
      user.userRoles.flatMap((entry) =>
        entry.role.rolePermissions.map((assignment) => assignment.permission.key),
      ),
    ),
  ].sort();

  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    status: user.status,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    roles,
    permissions,
  };
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
