import { JOBS } from '../constants';
import type { KvStore } from './kv';

const COMPLETED = 'completed';
const IN_PROGRESS = 'in_progress';

export class IdempotencyStore {
  constructor(
    private readonly kv: KvStore,
    private readonly prefix = 'idempotency',
  ) {}

  async isCompleted(key: string): Promise<boolean> {
    return (await this.kv.get(this.namespaced(key))) === COMPLETED;
  }

  async begin(key: string, ttlMs = JOBS.IDEMPOTENCY_TTL_MS): Promise<boolean> {
    if (await this.isCompleted(key)) {
      return false;
    }

    return this.kv.setNx(this.namespaced(key), IN_PROGRESS, ttlMs);
  }

  async complete(key: string, ttlMs = JOBS.IDEMPOTENCY_TTL_MS): Promise<void> {
    await this.kv.set(this.namespaced(key), COMPLETED, ttlMs);
  }

  async release(key: string): Promise<void> {
    const current = await this.kv.get(this.namespaced(key));
    if (current === IN_PROGRESS) {
      await this.kv.del(this.namespaced(key));
    }
  }

  private namespaced(key: string): string {
    return `${this.prefix}:${key}`;
  }
}
