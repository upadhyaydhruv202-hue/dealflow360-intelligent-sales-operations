import type { RedisClient } from '../../lib/redis';
import type { RateLimitIncrementResult, RateLimitStore } from './types';

export class RedisRateLimitStore implements RateLimitStore {
  constructor(private readonly redis: RedisClient) {}

  async increment(key: string, windowMs: number): Promise<RateLimitIncrementResult> {
    return this.redis.incrementWindow(key, windowMs);
  }
}
