import { describe, expect, it } from 'vitest';

import { RateLimiter } from '../security';
import { MemoryRateLimitStore } from '../security/rate-limit/memory-store';
import { primaryRole } from './types';

describe('primaryRole', () => {
  it('prefers admin over other assigned roles', () => {
    expect(primaryRole(['user', 'admin'])).toBe('admin');
    expect(primaryRole([])).toBe('user');
  });
});

describe('MemoryRateLimitStore', () => {
  it('allows requests under the max and blocks afterwards', async () => {
    const limiter = new RateLimiter({
      store: new MemoryRateLimitStore(),
      windowMs: 60_000,
      max: 2,
      prefix: 'test',
    });

    expect((await limiter.consume('user')).allowed).toBe(true);
    expect((await limiter.consume('user')).allowed).toBe(true);
    expect((await limiter.consume('user')).allowed).toBe(false);
    expect((await limiter.consume('other')).allowed).toBe(true);
  });
});
