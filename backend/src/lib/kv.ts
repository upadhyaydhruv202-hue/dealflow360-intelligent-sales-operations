export interface KvStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlMs?: number): Promise<void>;
  del(key: string): Promise<void>;
  setNx(key: string, value: string, ttlMs?: number): Promise<boolean>;
  pruneExpired?(): Promise<number>;
}

interface MemoryEntry {
  value: string;
  expiresAt?: number;
}

export class MemoryKvStore implements KvStore {
  private readonly entries = new Map<string, MemoryEntry>();

  async get(key: string): Promise<string | null> {
    const entry = this.entries.get(key);
    if (!entry) {
      return null;
    }

    if (entry.expiresAt !== undefined && entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return null;
    }

    return entry.value;
  }

  async set(key: string, value: string, ttlMs?: number): Promise<void> {
    this.entries.set(key, {
      value,
      expiresAt: ttlMs && ttlMs > 0 ? Date.now() + ttlMs : undefined,
    });
  }

  async del(key: string): Promise<void> {
    this.entries.delete(key);
  }

  async setNx(key: string, value: string, ttlMs?: number): Promise<boolean> {
    const existing = this.entries.get(key);
    if (existing && (existing.expiresAt === undefined || existing.expiresAt > Date.now())) {
      return false;
    }

    this.entries.set(key, {
      value,
      expiresAt: ttlMs && ttlMs > 0 ? Date.now() + ttlMs : undefined,
    });
    return true;
  }

  async pruneExpired(): Promise<number> {
    const now = Date.now();
    let removed = 0;
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt !== undefined && entry.expiresAt <= now) {
        this.entries.delete(key);
        removed += 1;
      }
    }
    return removed;
  }
}
