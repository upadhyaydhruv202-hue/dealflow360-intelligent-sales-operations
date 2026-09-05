import { JOBS } from '../constants';
import type { KvStore } from './kv';

export class CacheService {
  constructor(
    private readonly kv: KvStore,
    private readonly prefix = 'cache',
  ) {}

  async get(key: string): Promise<string | null> {
    return this.kv.get(this.namespaced(key));
  }

  async set(key: string, value: string, ttlMs: number = JOBS.CACHE_DEFAULT_TTL_MS): Promise<void> {
    await this.kv.set(this.namespaced(key), value, ttlMs);
  }

  async getJson<T>(key: string): Promise<T | undefined> {
    const raw = await this.get(key);
    if (raw === null) {
      return undefined;
    }

    try {
      return JSON.parse(raw) as T;
    } catch {
      await this.del(key);
      return undefined;
    }
  }

  async setJson(key: string, value: unknown, ttlMs: number = JOBS.CACHE_DEFAULT_TTL_MS): Promise<void> {
    await this.set(key, JSON.stringify(value), ttlMs);
  }

  async del(key: string): Promise<void> {
    await this.kv.del(this.namespaced(key));
  }

  private namespaced(key: string): string {
    return `${this.prefix}:${key}`;
  }
}
