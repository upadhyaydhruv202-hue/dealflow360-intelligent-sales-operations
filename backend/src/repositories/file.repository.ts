import type { StoredFile } from '@prisma/client';

import type {
  CreateStoredFileInput,
  FileStore,
  StoredFileRecord,
} from '../integrations/storage/storage.types';
import { mapPrismaError } from '../lib/prisma-error';
import type { DbClient } from './types';

export class FileRepository implements FileStore {
  constructor(private readonly db: DbClient) {}

  async create(input: CreateStoredFileInput): Promise<StoredFileRecord> {
    try {
      const row = await this.db.storedFile.create({
        data: {
          id: input.id,
          originalName: input.originalName,
          storedName: input.storedName,
          storageKey: input.key,
          mimeType: input.mimeType,
          sizeBytes: input.size,
          provider: input.provider,
          purpose: input.purpose,
          uploadedBy: input.uploadedBy ?? null,
        },
      });
      return toRecord(row);
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async findById(id: string): Promise<StoredFileRecord | null> {
    try {
      const row = await this.db.storedFile.findUnique({ where: { id } });
      return row ? toRecord(row) : null;
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async deleteById(id: string): Promise<void> {
    try {
      await this.db.storedFile.deleteMany({ where: { id } });
    } catch (error) {
      mapPrismaError(error);
    }
  }
}

function toRecord(row: StoredFile): StoredFileRecord {
  return {
    id: row.id,
    originalName: row.originalName,
    storedName: row.storedName,
    key: row.storageKey,
    mimeType: row.mimeType,
    size: row.sizeBytes,
    provider: row.provider,
    purpose: row.purpose as StoredFileRecord['purpose'],
    uploadedBy: row.uploadedBy,
    createdAt: row.createdAt,
  };
}
