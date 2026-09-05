import type { CreateStoredFileInput, FileStore, StoredFileRecord } from './storage.types';

export class MemoryFileStore implements FileStore {
  private readonly files = new Map<string, StoredFileRecord>();

  async create(input: CreateStoredFileInput): Promise<StoredFileRecord> {
    const record: StoredFileRecord = {
      id: input.id,
      originalName: input.originalName,
      storedName: input.storedName,
      key: input.key,
      mimeType: input.mimeType,
      size: input.size,
      provider: input.provider,
      purpose: input.purpose,
      uploadedBy: input.uploadedBy ?? null,
      createdAt: new Date(),
    };
    this.files.set(record.id, record);
    return record;
  }

  async findById(id: string): Promise<StoredFileRecord | null> {
    return this.files.get(id) ?? null;
  }

  async deleteById(id: string): Promise<void> {
    this.files.delete(id);
  }
}
