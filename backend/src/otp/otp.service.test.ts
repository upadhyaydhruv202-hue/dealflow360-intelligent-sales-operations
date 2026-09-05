import pino from 'pino';
import { describe, expect, it } from 'vitest';

import { loadConfig } from '../config';
import { AuthenticationError, ExternalServiceError, RateLimitError } from '../errors';
import { MemoryKvStore } from '../lib/kv';
import { FixedOtpGenerator } from './otp.generator';
import { OtpRepository } from './otp.repository';
import { createOtpService } from './otp.service';
import { MockOtpProvider } from './providers/mock.provider';
import type { OtpCodeGenerator } from './otp.types';

const logger = pino({ level: 'silent' });

function service(overrides: {
  generator?: OtpCodeGenerator;
  mock?: MockOtpProvider;
  now?: () => number;
  env?: Record<string, string>;
} = {}) {
  const mock = overrides.mock ?? new MockOtpProvider();
  return {
    mock,
    otp: createOtpService({
      config: loadConfig({
        NODE_ENV: 'test',
        FEATURE_OTP: 'true',
        OTP_PROVIDER: 'mock',
        OTP_DIGITS: '6',
        OTP_TTL: '10m',
        OTP_MAX_ATTEMPTS: '3',
        OTP_RESEND_COOLDOWN: '60s',
        ...overrides.env,
      }),
      logger,
      kv: new MemoryKvStore(),
      generator: overrides.generator ?? new FixedOtpGenerator('123456'),
      providers: { mock },
      now: overrides.now,
    }),
  };
}

describe('OtpService', () => {
  it('verifies a valid OTP once', async () => {
    const { otp, mock } = service();
    const requested = await otp.request({ destination: 'ada@example.com', channel: 'email' });
    expect(requested.digits).toBe(6);
    expect(JSON.stringify(requested)).not.toContain('123456');
    expect(mock.deliveries).toHaveLength(1);
    expect(JSON.stringify(mock.deliveries)).not.toContain('123456');

    await expect(
      otp.verify({ destination: 'ada@example.com', code: '123456' }),
    ).resolves.toMatchObject({ verified: true });
  });

  it('rejects an incorrect OTP', async () => {
    const { otp } = service();
    await otp.request({ destination: 'ada@example.com' });
    await expect(otp.verify({ destination: 'ada@example.com', code: '000000' })).rejects.toBeInstanceOf(
      AuthenticationError,
    );
  });

  it('rejects an expired OTP', async () => {
    let now = 1_000_000;
    const { otp } = service({ now: () => now, env: { OTP_TTL: '1s' } });
    await otp.request({ destination: 'ada@example.com' });
    now += 2_000;
    await expect(otp.verify({ destination: 'ada@example.com', code: '123456' })).rejects.toMatchObject({
      message: 'OTP has expired',
    });
  });

  it('rejects a reused OTP', async () => {
    const { otp } = service();
    await otp.request({ destination: 'ada@example.com' });
    await otp.verify({ destination: 'ada@example.com', code: '123456' });
    await expect(otp.verify({ destination: 'ada@example.com', code: '123456' })).rejects.toMatchObject({
      message: 'OTP has already been used',
    });
  });

  it('locks after too many attempts', async () => {
    const { otp } = service({ env: { OTP_MAX_ATTEMPTS: '2' } });
    await otp.request({ destination: 'ada@example.com' });
    await expect(otp.verify({ destination: 'ada@example.com', code: '000000' })).rejects.toBeInstanceOf(
      AuthenticationError,
    );
    await expect(otp.verify({ destination: 'ada@example.com', code: '000000' })).rejects.toBeInstanceOf(
      AuthenticationError,
    );
    await expect(otp.verify({ destination: 'ada@example.com', code: '123456' })).rejects.toMatchObject({
      message: 'Too many incorrect OTP attempts',
    });
  });

  it('throttles resend before the cooldown elapses', async () => {
    const { otp } = service();
    await otp.request({ destination: 'ada@example.com' });
    await expect(otp.request({ destination: 'ada@example.com' })).rejects.toBeInstanceOf(RateLimitError);
  });

  it('maps provider failure to ExternalServiceError and does not leave a usable code', async () => {
    const mock = new MockOtpProvider();
    mock.failNext = true;
    const { otp } = service({ mock });
    await expect(otp.request({ destination: 'ada@example.com' })).rejects.toBeInstanceOf(ExternalServiceError);
    await expect(otp.verify({ destination: 'ada@example.com', code: '123456' })).rejects.toBeInstanceOf(
      AuthenticationError,
    );
  });

  it('stores a hash rather than the plaintext code', async () => {
    const kv = new MemoryKvStore();
    const otp = createOtpService({
      config: loadConfig({ NODE_ENV: 'test', FEATURE_OTP: 'true', OTP_PROVIDER: 'mock' }),
      logger,
      kv,
      generator: new FixedOtpGenerator('123456'),
    });
    await otp.request({ destination: 'ada@example.com' });
    const stored = await kv.get('otp:challenge:login:ada@example.com');
    expect(stored).toBeTruthy();
    expect(stored).not.toContain('123456');
  });

  it('allows only one concurrent successful verify', async () => {
    const { otp } = service();
    await otp.request({ destination: 'ada@example.com' });
    const results = await Promise.allSettled([
      otp.verify({ destination: 'ada@example.com', code: '123456' }),
      otp.verify({ destination: 'ada@example.com', code: '123456' }),
    ]);
    expect(results.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((item) => item.status === 'rejected')).toHaveLength(1);
  });

  it('describeRequest returns the same metadata without delivering', async () => {
    const { otp, mock } = service();
    const described = otp.describeRequest({ destination: 'Ada@Example.com', channel: 'email' });
    expect(described).toMatchObject({
      destination: 'ada@example.com',
      channel: 'email',
      purpose: 'login',
      digits: 6,
    });
    expect(mock.deliveries).toHaveLength(0);
  });
});

describe('OtpRepository', () => {
  it('normalizes destinations', async () => {
    const repo = new OtpRepository(new MemoryKvStore());
    await repo.create({
      purpose: 'login',
      destination: 'Ada@Example.com',
      channel: 'email',
      codeHash: 'abc',
      digits: 6,
      maxAttempts: 5,
      expiresAt: Date.now() + 60_000,
      lastSentAt: Date.now(),
    });
    const found = await repo.get('login', 'ada@example.com');
    expect(found?.destination).toBe('ada@example.com');
  });
});
