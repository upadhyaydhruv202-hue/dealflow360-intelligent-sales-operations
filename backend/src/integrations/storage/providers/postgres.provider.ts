import { NotFoundError } from '../../../errors';
import { assertStorageKey } from '../storage.keys';
import type { StorageProvider, StoragePutInput, StoredObject } from '../storage.types';

export interface ObjectStoreRecord {
  body: Buffer;
  contentType: string;
}

export interface ObjectStore {
  put(input: { key: string; body: Buffer; contentType: string; sizeBytes: number }): Promise<void>;
  get(key: string): Promise<ObjectStoreRecord | null>;
  delete(key: string): Promise<void>;
}

export class PostgresStorageProvider implements StorageProvider {
  readonly name = 'postgres';

  constructor(private readonly store: ObjectStore) {}

  async put(input: StoragePutInput): Promise<StoredObject> {
    const key = assertStorageKey(input.key);
    await this.store.put({
      key,
      body: input.body,
      contentType: input.contentType,
      sizeBytes: input.body.length,
    });

    return {
      key,
      size: input.body.length,
      contentType: input.contentType,
    };
  }

  async get(key: string): Promise<Buffer> {
    const record = await this.store.get(assertStorageKey(key));
    if (!record) {
      throw new NotFoundError('Stored file was not found');
    }

    return record.body;
  }

  async delete(key: string): Promise<void> {
    await this.store.delete(assertStorageKey(key));
  }
}

export class MemoryObjectStore implements ObjectStore {
  private readonly objects = new Map<string, ObjectStoreRecord>();

  async put(input: { key: string; body: Buffer; contentType: string; sizeBytes?: number }): Promise<void> {
    this.objects.set(input.key, { body: input.body, contentType: input.contentType });
  }

  async get(key: string): Promise<ObjectStoreRecord | null> {
    return this.objects.get(key) ?? null;
  }

  async delete(key: string): Promise<void> {
    this.objects.delete(key);
  }
}
