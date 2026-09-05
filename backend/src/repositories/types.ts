import type { Prisma, PrismaClient } from '@prisma/client';

export type DbClient = PrismaClient | Prisma.TransactionClient;

export type PublicUser = {
  id: string;
  email: string;
  displayName: string;
  status: 'active' | 'invited' | 'disabled';
  createdAt: Date;
  updatedAt: Date;
};

export type UserWithRoles = PublicUser & {
  roles: string[];
  permissions: string[];
};

export const publicUserSelect = {
  id: true,
  email: true,
  displayName: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;
