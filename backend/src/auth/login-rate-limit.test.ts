import { describe, expect, it } from 'vitest';

import { loadConfig } from '../config';
import { RateLimitError } from '../errors';
import { MemoryRateLimitStore } from '../security/rate-limit/memory-store';
import { createLoginRateLimit } from './login-rate-limit';

const AUTH_ENV = {
  NODE_ENV: 'test',
  JWT_ACCESS_SECRET: 'test-access-secret-not-for-production-32',
  JWT_REFRESH_SECRET: 'test-refresh-secret-not-for-production-32',
  RATE_LIMIT_ENABLED: 'true',
  AUTH_LOGIN_RATE_LIMIT_MAX: '1',
  AUTH_LOGIN_IP_RATE_LIMIT_MAX: '100',
  AUTH_LOGIN_RATE_LIMIT_WINDOW: '15m',
} as const;

function invoke(
  handler: ReturnType<typeof createLoginRateLimit>,
  email: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    handler(
      { body: { email }, ip: '127.0.0.1', socket: { remoteAddress: '127.0.0.1' } } as never,
      { setHeader() {} } as never,
      (error?: unknown) => {
        if (error) reject(error);
        else resolve();
      },
    );
  });
}

describe('createLoginRateLimit', () => {
  it('rate-limits arbitrary accounts even when DEMO_MODE is on', async () => {
    const handler = createLoginRateLimit({
      store: new MemoryRateLimitStore(),
      config: loadConfig({ ...AUTH_ENV, DEMO_MODE: 'true' }),
    });

    await invoke(handler, 'limited@example.com');
    await expect(invoke(handler, 'limited@example.com')).rejects.toBeInstanceOf(RateLimitError);
  });

  it('allows repeated seeded demo-account logins only in DEMO_MODE', async () => {
    const demoHandler = createLoginRateLimit({
      store: new MemoryRateLimitStore(),
      config: loadConfig({ ...AUTH_ENV, DEMO_MODE: 'true' }),
    });

    await invoke(demoHandler, 'demo.staff@example.com');
    await invoke(demoHandler, '  Demo.Staff@example.com ');
    await invoke(demoHandler, 'demo.manager@example.com');
  });

  it('still rate-limits seeded demo emails when DEMO_MODE is off', async () => {
    const handler = createLoginRateLimit({
      store: new MemoryRateLimitStore(),
      config: loadConfig({ ...AUTH_ENV, DEMO_MODE: 'false' }),
    });

    await invoke(handler, 'demo.staff@example.com');
    await expect(invoke(handler, 'demo.staff@example.com')).rejects.toBeInstanceOf(RateLimitError);
  });
});
