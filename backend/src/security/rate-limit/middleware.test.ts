import { describe, expect, it } from 'vitest';

import { RateLimitError } from '../../errors';
import { MemoryRateLimitStore } from './memory-store';
import { RateLimiter } from './limiter';
import { createRateLimitStore, rateLimit } from './index';

describe('rateLimit middleware', () => {
  it('fails closed when the store errors in production-style mode', async () => {
    const limiter = new RateLimiter({
      store: {
        increment: async () => {
          throw new Error('redis down');
        },
      },
      windowMs: 1000,
      max: 5,
      prefix: 'test',
      enabled: true,
    });

    const middleware = rateLimit({
      limiter,
      keyFn: () => 'ip',
      failClosed: true,
      message: 'Too many requests',
    });

    await expect(
      new Promise((resolve, reject) => {
        middleware({} as never, { setHeader() {} } as never, (error?: unknown) => {
          if (error) reject(error);
          else resolve(undefined);
        });
      }),
    ).rejects.toBeInstanceOf(RateLimitError);
  });

  it('fails open when the store errors and failClosed is false', async () => {
    const limiter = new RateLimiter({
      store: {
        increment: async () => {
          throw new Error('redis down');
        },
      },
      windowMs: 1000,
      max: 5,
      prefix: 'test',
      enabled: true,
    });

    const middleware = rateLimit({
      limiter,
      keyFn: () => 'ip',
      failClosed: false,
    });

    await new Promise<void>((resolve, reject) => {
      middleware({} as never, { setHeader() {} } as never, (error?: unknown) => {
        if (error) reject(error);
        else resolve();
      });
    });
  });

  it('blocks the request after the max is exceeded', async () => {
    const limiter = new RateLimiter({
      store: new MemoryRateLimitStore(),
      windowMs: 60_000,
      max: 1,
      prefix: 'test',
    });
    const middleware = rateLimit({
      limiter,
      keyFn: () => 'ip',
    });
    const res = { headers: new Map<string, string>(), setHeader(name: string, value: string) { this.headers.set(name, value); } };

    await new Promise<void>((resolve, reject) => {
      middleware({} as never, res as never, (error?: unknown) => {
        if (error) reject(error);
        else resolve();
      });
    });

    await expect(
      new Promise((resolve, reject) => {
        middleware({} as never, res as never, (error?: unknown) => {
          if (error) reject(error);
          else resolve(undefined);
        });
      }),
    ).rejects.toBeInstanceOf(RateLimitError);
  });
});

describe('createRateLimitStore', () => {
  it('refuses in-memory fallback when allowMemory is false', () => {
    expect(() => createRateLimitStore(null, { allowMemory: false })).toThrow(/REDIS_URL/);
  });
});
