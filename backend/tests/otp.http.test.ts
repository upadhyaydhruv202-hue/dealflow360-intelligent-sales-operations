import pino from 'pino';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/app';
import { loadConfig } from '../src/config';
import { ERROR_CODES } from '../src/constants';
import { createDatabaseClient, type DatabaseClient } from '../src/lib/database';
import { FixedOtpGenerator } from '../src/otp';
import { AUTH_TEST_ENV } from './helpers/auth';
import {
  describeDatabase,
  disconnectTestPrisma,
  getTestRepositories,
  resetDatabase,
} from './helpers/database';

const logger = pino({ level: 'silent' });

function otpApp(overrides: Record<string, string> = {}) {
  return createApp({
    config: loadConfig({
      NODE_ENV: 'test',
      FEATURE_OTP: 'true',
      OTP_PROVIDER: 'mock',
      OTP_RESEND_COOLDOWN: '0s',
      RATE_LIMIT_ENABLED: 'false',
      ...overrides,
    }),
    logger,
    otpGenerator: new FixedOtpGenerator('123456'),
  }).app;
}

describe('OTP HTTP', () => {
  it('requests and verifies a valid OTP', async () => {
    const app = otpApp();
    const requested = await request(app).post('/api/v1/auth/otp/request').send({
      destination: 'ada@example.com',
      channel: 'email',
      purpose: 'login',
    });

    expect(requested.status).toBe(200);
    expect(requested.body.success).toBe(true);
    expect(requested.body.data.digits).toBe(6);
    expect(JSON.stringify(requested.body)).not.toContain('123456');

    const verified = await request(app).post('/api/v1/auth/otp/verify').send({
      destination: 'ada@example.com',
      purpose: 'login',
      code: '123456',
    });
    expect(verified.status).toBe(200);
    expect(verified.body.data.verified).toBe(true);
  });

  it('rejects an incorrect OTP', async () => {
    const app = otpApp();
    await request(app).post('/api/v1/auth/otp/request').send({ destination: 'ada@example.com' });
    const response = await request(app).post('/api/v1/auth/otp/verify').send({
      destination: 'ada@example.com',
      code: '000000',
    });
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe(ERROR_CODES.AUTHENTICATION_ERROR);
  });

  it('rejects SMS when SMS is not configured', async () => {
    const app = createApp({
      config: loadConfig({
        NODE_ENV: 'test',
        FEATURE_OTP: 'true',
        OTP_PROVIDER: 'auto',
        SMS_ENABLED: 'false',
        FEATURE_SMS: 'false',
        DEMO_MODE: 'false',
        EMAIL_ENABLED: 'true',
        EMAIL_PROVIDER: 'mock',
        EMAIL_FROM: 'noreply@example.com',
        RATE_LIMIT_ENABLED: 'false',
      }),
      logger,
      otpGenerator: new FixedOtpGenerator('123456'),
    }).app;

    const response = await request(app).post('/api/v1/auth/otp/request').send({
      destination: '+15551234567',
      channel: 'sms',
    });
    expect(response.status).toBe(502);
    expect(response.body.error.code).toBe(ERROR_CODES.EXTERNAL_SERVICE_ERROR);
  });

  it('returns FEATURE_DISABLED when OTP is disabled', async () => {
    const app = createApp({
      config: loadConfig({ NODE_ENV: 'test', FEATURE_OTP: 'false' }),
      logger,
    }).app;
    const response = await request(app).post('/api/v1/auth/otp/request').send({
      destination: 'ada@example.com',
    });
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe(ERROR_CODES.FEATURE_DISABLED);
    expect(response.body.error.message).toBe('otp is not enabled');
  });

  it('rate limits repeated OTP requests for the same destination', async () => {
    const app = otpApp({
      RATE_LIMIT_ENABLED: 'true',
      OTP_RATE_LIMIT_MAX: '1',
      OTP_IP_RATE_LIMIT_MAX: '100',
      OTP_RATE_LIMIT_WINDOW: '15m',
    });

    const first = await request(app).post('/api/v1/auth/otp/request').send({
      destination: 'ada@example.com',
    });
    expect(first.status).toBe(200);

    const second = await request(app).post('/api/v1/auth/otp/request').send({
      destination: 'ada@example.com',
    });
    expect(second.status).toBe(429);
    expect(second.body.error.code).toBe(ERROR_CODES.RATE_LIMIT);
  });

  it('validates destination for the selected channel', async () => {
    const app = otpApp();
    const response = await request(app).post('/api/v1/auth/otp/request').send({
      destination: 'not-an-email',
      channel: 'email',
    });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
  });
});

describeDatabase('OTP HTTP login session', () => {
  let database!: DatabaseClient;
  let app!: ReturnType<typeof createApp>['app'];

  beforeAll(() => {
    database = createDatabaseClient({
      url: process.env.DATABASE_URL as string,
      poolMax: 5,
      poolTimeoutSeconds: 10,
    });
    app = createApp({
      config: loadConfig({
        ...AUTH_TEST_ENV,
        DATABASE_URL: process.env.DATABASE_URL,
        FEATURE_OTP: 'true',
        OTP_PROVIDER: 'mock',
        OTP_RESEND_COOLDOWN: '0s',
      }),
      logger,
      database,
      otpGenerator: new FixedOtpGenerator('123456'),
    }).app;
  });

  beforeEach(async () => {
    await resetDatabase();
    await getTestRepositories().roles.create({
      name: 'user',
      description: 'Standard application access',
    });
  });

  afterAll(async () => {
    await database.close();
    await disconnectTestPrisma();
  });

  it('issues tokens after a valid login OTP for an existing user', async () => {
    await request(app).post('/api/v1/auth/register').send({
      email: 'ada@example.com',
      password: 'correct-horse',
      displayName: 'Ada',
    });

    const requested = await request(app).post('/api/v1/auth/otp/request').send({
      destination: 'ada@example.com',
      purpose: 'login',
    });
    expect(requested.status).toBe(200);

    const verified = await request(app).post('/api/v1/auth/otp/verify').send({
      destination: 'ada@example.com',
      purpose: 'login',
      code: '123456',
    });
    expect(verified.status).toBe(200);
    expect(verified.body.data.verified).toBe(true);
    expect(verified.body.data.tokens.accessToken).toEqual(expect.any(String));
    expect(verified.body.data.user.email).toBe('ada@example.com');

    const me = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${verified.body.data.tokens.accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.data.user.email).toBe('ada@example.com');
  });

  it('does not reveal whether an unknown email has an account', async () => {
    const requested = await request(app).post('/api/v1/auth/otp/request').send({
      destination: 'missing@example.com',
      purpose: 'login',
    });
    expect(requested.status).toBe(200);
    expect(requested.body.data.digits).toBe(6);

    const verified = await request(app).post('/api/v1/auth/otp/verify').send({
      destination: 'missing@example.com',
      purpose: 'login',
      code: '123456',
    });
    expect(verified.status).toBe(401);
    expect(verified.body.data?.tokens).toBeUndefined();
  });

  it('does not issue tokens for a non-login OTP purpose', async () => {
    await request(app).post('/api/v1/auth/register').send({
      email: 'ada@example.com',
      password: 'correct-horse',
      displayName: 'Ada',
    });

    const requested = await request(app).post('/api/v1/auth/otp/request').send({
      destination: 'ada@example.com',
      purpose: 'verification',
    });
    expect(requested.status).toBe(200);

    const verified = await request(app).post('/api/v1/auth/otp/verify').send({
      destination: 'ada@example.com',
      purpose: 'verification',
      code: '123456',
    });
    expect(verified.status).toBe(200);
    expect(verified.body.data.verified).toBe(true);
    expect(verified.body.data.tokens).toBeUndefined();
    expect(verified.body.data.user).toBeUndefined();
  });
});
