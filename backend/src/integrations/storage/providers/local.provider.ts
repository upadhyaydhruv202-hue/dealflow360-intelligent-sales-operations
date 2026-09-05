import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { NotFoundError } from '../../../errors';
import { resolveStoragePath } from '../storage.keys';
import type { StorageProvider, StoragePutInput, StoredObject } from '../storage.types';

export class LocalStorageProvider implements StorageProvider {
  readonly name = 'local';

  constructor(private readonly rootDir: string) {}

  async put(input: StoragePutInput): Promise<StoredObject> {
    const filePath = resolveStoragePath(this.rootDir, input.key);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, input.body);

    return {
      key: input.key,
      size: input.body.length,
      contentType: input.contentType,
    };
  }

  async get(key: string): Promise<Buffer> {
    const filePath = resolveStoragePath(this.rootDir, key);

    try {
      return await readFile(filePath);
    } catch (error) {
      if (isNotFound(error)) {
        throw new NotFoundError('Stored file was not found');
      }

      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    const filePath = resolveStoragePath(this.rootDir, key);

    try {
      await unlink(filePath);
    } catch (error) {
      if (isNotFound(error)) {
        return;
      }

      throw error;
    }
  }
}

function isNotFound(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && (error as { code?: string }).code === 'ENOENT');
}
