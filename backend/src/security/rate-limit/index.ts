import type { Pingable } from '../../types/lifecycle';
import { isRedisClient, type RedisClient } from '../../lib/redis';
import { MemoryRateLimitStore } from './memory-store';
import { RedisRateLimitStore } from './redis-store';
import type { RateLimitStore } from './types';

export function createRateLimitStore(
  redis?: Pingable | RedisClient | null,
  options: { allowMemory?: boolean } = {},
): RateLimitStore {
  if (isRedisClient(redis)) {
    return new RedisRateLimitStore(redis);
  }

  if (options.allowMemory === false) {
    throw new Error('In-memory rate limiting is not allowed; set REDIS_URL');
  }

  return new MemoryRateLimitStore();
}

export { MemoryRateLimitStore } from './memory-store';
export { RedisRateLimitStore } from './redis-store';
export { RateLimiter } from './limiter';
export { rateLimit } from './middleware';
export { createIdentityAndIpRateLimit } from './identity';
export { createSecurityRateLimits, RATE_LIMIT_CATEGORIES } from './categories';
export type { RateLimitStore, RateLimiterOptions, RateLimitDecision } from './types';
export type { RateLimitCategory, SecurityRateLimits } from './categories';
