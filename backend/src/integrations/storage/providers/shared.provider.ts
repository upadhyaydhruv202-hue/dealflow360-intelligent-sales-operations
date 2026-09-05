import { NotFoundError } from '../../../errors';
import type { StorageProvider, StoragePutInput, StoredObject } from '../storage.types';

/**
 * Writes to a remote store (Postgres) and a local cache. Reads local first,
 * then remote so API and workers on different machines share bytes via the database.
 */
export class SharedStorageProvider implements StorageProvider {
  readonly name = 'shared';

  constructor(
    private readonly local: StorageProvider,
    private readonly remote: StorageProvider,
  ) {}

  async put(input: StoragePutInput): Promise<StoredObject> {
    const stored = await this.remote.put(input);
    await this.local.put(input);
    return stored;
  }

  async get(key: string): Promise<Buffer> {
    try {
      return await this.local.get(key);
    } catch (error) {
      if (error instanceof NotFoundError) {
        const body = await this.remote.get(key);
        await this.local.put({
          key,
          body,
          contentType: 'application/octet-stream',
        });
        return body;
      }

      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    await Promise.all([this.local.delete(key), this.remote.delete(key)]);
  }
}
