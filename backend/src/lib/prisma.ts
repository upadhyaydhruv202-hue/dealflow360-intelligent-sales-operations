import { PrismaClient } from '@prisma/client';

import { withPoolParams } from './prisma-url';

export interface CreatePrismaClientOptions {
  url: string;
  poolMax?: number;
  poolTimeoutSeconds?: number;
}

export function createPrismaClient(options: CreatePrismaClientOptions): PrismaClient {
  const url = withPoolParams(options.url, options.poolMax ?? 10, options.poolTimeoutSeconds ?? 10);

  return new PrismaClient({
    datasources: {
      db: { url },
    },
    log: process.env.NODE_ENV === 'test' || process.env.VITEST ? [] : ['error'],
  });
}
