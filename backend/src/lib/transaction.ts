import type { Prisma, PrismaClient } from '@prisma/client';

export type TransactionClient = Prisma.TransactionClient;

export interface TransactionOptions {
  maxWaitMs?: number;
  timeoutMs?: number;
  isolationLevel?: Prisma.TransactionIsolationLevel;
}

export async function withTransaction<T>(
  prisma: PrismaClient,
  callback: (tx: TransactionClient) => Promise<T>,
  options: TransactionOptions = {},
): Promise<T> {
  return prisma.$transaction((tx) => callback(tx), {
    maxWait: options.maxWaitMs ?? 5_000,
    timeout: options.timeoutMs ?? 15_000,
    isolationLevel: options.isolationLevel,
  });
}
