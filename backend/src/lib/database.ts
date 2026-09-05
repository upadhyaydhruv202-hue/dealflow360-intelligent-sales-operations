import type { PrismaClient } from '@prisma/client';

import type { Closable, Pingable } from '../types/lifecycle';
import { createPrismaClient } from './prisma';

export interface DatabaseClient extends Pingable, Closable {
  prisma: PrismaClient;
}

export interface CreateDatabaseClientOptions {
  url: string;
  poolMax?: number;
  poolTimeoutSeconds?: number;
}

export function createDatabaseClient(options: CreateDatabaseClientOptions): DatabaseClient {
  const prisma = createPrismaClient(options);

  return {
    name: 'database',
    prisma,
    async ping() {
      await prisma.$queryRaw`SELECT 1`;
    },
    async close() {
      await prisma.$disconnect();
    },
  };
}
