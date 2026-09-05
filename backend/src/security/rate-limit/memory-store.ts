import type { RateLimitIncrementResult, RateLimitStore } from './types';

interface MemoryEntry {
  count: number;
  resetAt: number;
}

export class MemoryRateLimitStore implements RateLimitStore {
  private readonly entries = new Map<string, MemoryEntry>();

  async increment(key: string, windowMs: number): Promise<RateLimitIncrementResult> {
    const now = Date.now();
    const current = this.entries.get(key);

    if (!current || current.resetAt <= now) {
      const next = { count: 1, resetAt: now + windowMs };
      this.entries.set(key, next);
      return next;
    }

    current.count += 1;
    this.entries.set(key, current);
    return current;
  }
}
