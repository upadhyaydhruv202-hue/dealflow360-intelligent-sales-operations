import type { PrismaClient } from '@prisma/client';

import type { ObjectStore, ObjectStoreRecord } from './postgres.provider';

export class PrismaObjectStore implements ObjectStore {
  constructor(private readonly prisma: PrismaClient) {}

  async put(input: { key: string; body: Buffer; contentType: string; sizeBytes: number }): Promise<void> {
    await this.prisma.storedObject.upsert({
      where: { key: input.key },
      create: {
        key: input.key,
        body: Uint8Array.from(input.body),
        contentType: input.contentType,
        sizeBytes: input.sizeBytes,
      },
      update: {
        body: Uint8Array.from(input.body),
        contentType: input.contentType,
        sizeBytes: input.sizeBytes,
      },
    });
  }

  async get(key: string): Promise<ObjectStoreRecord | null> {
    const record = await this.prisma.storedObject.findUnique({ where: { key } });
    if (!record) {
      return null;
    }

    return {
      body: Buffer.from(record.body),
      contentType: record.contentType,
    };
  }

  async delete(key: string): Promise<void> {
    await this.prisma.storedObject.deleteMany({ where: { key } });
  }
}
