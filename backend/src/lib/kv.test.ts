import { describe, expect, it } from 'vitest';

import { createKvStore } from './redis';
import { CacheService } from './cache';
import { IdempotencyStore } from './idempotency';
import { MemoryKvStore } from './kv';
import { OtpStore } from './otp-store';

describe('MemoryKvStore', () => {
  it('sets, gets, and deletes values', async () => {
    const kv = new MemoryKvStore();
    await kv.set('a', '1');
    expect(await kv.get('a')).toBe('1');
    await kv.del('a');
    expect(await kv.get('a')).toBeNull();
  });

  it('expires keys after ttl', async () => {
    const kv = new MemoryKvStore();
    await kv.set('a', '1', 1);
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(await kv.get('a')).toBeNull();
  });

  it('setNx claims a key once', async () => {
    const kv = new MemoryKvStore();
    expect(await kv.setNx('lock', '1', 1000)).toBe(true);
    expect(await kv.setNx('lock', '2', 1000)).toBe(false);
    expect(await kv.get('lock')).toBe('1');
  });
});

describe('CacheService', () => {
  it('round-trips JSON with a namespace', async () => {
    const cache = new CacheService(new MemoryKvStore());
    await cache.setJson('user:1', { name: 'Ada' }, 60_000);
    await expect(cache.getJson<{ name: string }>('user:1')).resolves.toEqual({ name: 'Ada' });
    await cache.del('user:1');
    await expect(cache.getJson('user:1')).resolves.toBeUndefined();
  });
});

describe('IdempotencyStore', () => {
  it('prevents a second begin until release', async () => {
    const store = new IdempotencyStore(new MemoryKvStore());
    expect(await store.begin('email-1')).toBe(true);
    expect(await store.begin('email-1')).toBe(false);
    await store.release('email-1');
    expect(await store.begin('email-1')).toBe(true);
  });

  it('treats completed keys as duplicates', async () => {
    const store = new IdempotencyStore(new MemoryKvStore());
    expect(await store.begin('pay-1')).toBe(true);
    await store.complete('pay-1');
    expect(await store.isCompleted('pay-1')).toBe(true);
    expect(await store.begin('pay-1')).toBe(false);
    await store.release('pay-1');
    expect(await store.isCompleted('pay-1')).toBe(true);
  });
});

describe('OtpStore', () => {
  it('verifies a code once and never stores plaintext', async () => {
    const kv = new MemoryKvStore();
    const otp = new OtpStore(kv);
    await otp.put('login', 'ada@example.com', '123456');
    const stored = await kv.get('otp:login:ada@example.com');
    expect(stored).toBeTruthy();
    expect(stored).not.toContain('123456');
    await expect(otp.verify('login', 'ada@example.com', '000000')).resolves.toBe(false);
    await expect(otp.verify('login', 'ada@example.com', '123456')).resolves.toBe(true);
    await expect(otp.verify('login', 'ada@example.com', '123456')).resolves.toBe(false);
  });
});

describe('createKvStore', () => {
  it('refuses in-memory fallback when allowMemory is false', () => {
    expect(() => createKvStore(null, { allowMemory: false })).toThrow(/REDIS_URL/);
    expect(createKvStore(null).constructor.name).toBe('MemoryKvStore');
  });
});
