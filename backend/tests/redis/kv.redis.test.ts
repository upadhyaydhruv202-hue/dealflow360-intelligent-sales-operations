import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CacheService } from '../../src/lib/cache';
import { IdempotencyStore } from '../../src/lib/idempotency';
import { createExternalMocks, createRejectingFetch } from '../mocks';
import { createTestRedis, describeRedis, redisTestPrefix } from '../helpers/redis';

describeRedis('Redis KV integration', () => {
  let redis: ReturnType<typeof createTestRedis>;
  const prefix = redisTestPrefix();

  beforeAll(() => {
    redis = createTestRedis();
  });

  afterAll(async () => {
    await redis.close();
  });

  it('sets, gets, and claims keys once', async () => {
    const valueKey = `${prefix}:value`;
    const lockKey = `${prefix}:lock`;
    await redis.ping();
    await redis.set(valueKey, 'ok', 30_000);
    expect(await redis.get(valueKey)).toBe('ok');
    expect(await redis.setNx(lockKey, '1', 30_000)).toBe(true);
    expect(await redis.setNx(lockKey, '2', 30_000)).toBe(false);
    await redis.del(valueKey);
    await redis.del(lockKey);
  });

  it('expires keys and supports rate-limit windows', async () => {
    const ttlKey = `${prefix}:ttl`;
    const windowKey = `${prefix}:window`;
    await redis.set(ttlKey, '1', 40);
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(await redis.get(ttlKey)).toBeNull();

    const first = await redis.incrementWindow(windowKey, 5_000);
    const second = await redis.incrementWindow(windowKey, 5_000);
    expect(first.count).toBe(1);
    expect(second.count).toBe(2);
    await redis.del(windowKey);
  });

  it('backs cache and idempotency stores', async () => {
    const cache = new CacheService(redis, `${prefix}:cache`);
    const idempotency = new IdempotencyStore(redis, `${prefix}:idem`);

    await cache.setJson('report:1', { total: 12 }, 30_000);
    await expect(cache.getJson<{ total: number }>('report:1')).resolves.toEqual({ total: 12 });
    await cache.del('report:1');

    expect(await idempotency.begin('email:welcome')).toBe(true);
    expect(await idempotency.begin('email:welcome')).toBe(false);
    await idempotency.complete('email:welcome');
    expect(await idempotency.isCompleted('email:welcome')).toBe(true);
  });
});

describe('external mocks (no SaaS)', () => {
  it('builds in-process providers and a rejecting fetch', async () => {
    const mocks = createExternalMocks();
    mocks.ai.enqueue('hello');
    const generated = await mocks.ai.generateText({
      operation: 'generateText',
      contents: [{ role: 'user', text: 'hi' }],
    });
    expect(generated.text).toBe('hello');
    expect(mocks.email.name).toBe('mock');
    expect(mocks.sms.name).toBe('mock');
    await expect(createRejectingFetch('down')('https://example.com')).rejects.toThrow('down');
  });
});
