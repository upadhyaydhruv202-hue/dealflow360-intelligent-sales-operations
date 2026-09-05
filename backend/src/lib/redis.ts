import Redis from 'ioredis';

import type { Closable, Pingable } from '../types/lifecycle';
import type { RateLimitIncrementResult } from '../security/rate-limit/types';
import type { KvStore } from './kv';
import { MemoryKvStore } from './kv';

const INCREMENT_WINDOW_SCRIPT = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('PTTL', KEYS[1])
if ttl < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
return { current, ttl }
`;

export interface RedisClient extends Pingable, Closable, KvStore {
  incrementWindow(key: string, windowMs: number): Promise<RateLimitIncrementResult>;
}

export function isRedisClient(value: unknown): value is RedisClient {
  return Boolean(value) && typeof value === 'object' && 'incrementWindow' in (value as object);
}

export function createKvStore(
  redis?: RedisClient | KvStore | null,
  options: { allowMemory?: boolean } = {},
): KvStore {
  if (redis && typeof redis.get === 'function' && typeof redis.setNx === 'function') {
    return redis;
  }

  if (options.allowMemory === false) {
    throw new Error('In-memory KV is not allowed; set REDIS_URL');
  }

  return new MemoryKvStore();
}

export function createRedisClient(url: string): RedisClient {
  const redis = new Redis(url, {
    maxRetriesPerRequest: 1,
    connectTimeout: 3000,
    lazyConnect: true,
    enableOfflineQueue: false,
  });

  return {
    name: 'redis',
    async ping() {
      await ensureConnected(redis);
      const result = await redis.ping();
      if (result !== 'PONG') {
        throw new Error(`Unexpected Redis ping response: ${String(result)}`);
      }
    },
    async get(key: string) {
      await ensureConnected(redis);
      return redis.get(key);
    },
    async set(key: string, value: string, ttlMs?: number) {
      await ensureConnected(redis);
      if (ttlMs && ttlMs > 0) {
        await redis.set(key, value, 'PX', ttlMs);
        return;
      }

      await redis.set(key, value);
    },
    async del(key: string) {
      await ensureConnected(redis);
      await redis.del(key);
    },
    async setNx(key: string, value: string, ttlMs?: number) {
      await ensureConnected(redis);
      const result =
        ttlMs && ttlMs > 0
          ? await redis.set(key, value, 'PX', ttlMs, 'NX')
          : await redis.set(key, value, 'NX');
      return result === 'OK';
    },
    async incrementWindow(key: string, windowMs: number) {
      await ensureConnected(redis);
      const result = (await redis.eval(INCREMENT_WINDOW_SCRIPT, 1, key, String(windowMs))) as [
        number,
        number,
      ];
      const count = Number(result[0]);
      const ttlMs = Number(result[1]);
      return {
        count,
        resetAt: Date.now() + Math.max(ttlMs, 0),
      };
    },
    async close() {
      redis.disconnect();
    },
  };
}

async function ensureConnected(redis: Redis): Promise<void> {
  if (redis.status !== 'ready' && redis.status !== 'connecting' && redis.status !== 'connect') {
    await redis.connect();
  }
}
