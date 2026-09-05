import type { KvStore } from '../lib/kv';

export interface SchedulerLock {
  tryAcquire(key: string, ttlMs: number): Promise<boolean>;
}

export function createSchedulerLock(kv: KvStore): SchedulerLock {
  return {
    async tryAcquire(key: string, ttlMs: number) {
      return kv.setNx(`scheduler:lock:${key}`, '1', Math.max(1_000, ttlMs));
    },
  };
}
