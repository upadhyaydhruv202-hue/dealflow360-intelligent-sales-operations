import pino from 'pino';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app';
import { loadConfig } from '../src/config';
import { ERROR_CODES } from '../src/constants';

const logger = pino({ level: 'silent' });

function buildApp(overrides?: {
  database?: { ping(): Promise<void> } | null;
  redis?: { ping(): Promise<void> } | null;
}) {
  const config = loadConfig({
    NODE_ENV: 'test',
    APP_NAME: 'Hackathon Starter Kit',
  });

  return createApp({
    config,
    logger,
    database: overrides?.database,
    redis: overrides?.redis,
  }).app;
}

describe('HTTP foundation', () => {
  it('GET /health returns application status', async () => {
    const response = await request(buildApp()).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('ok');
    expect(response.body.data.service).toBe('Hackathon Starter Kit');
    expect(response.body.data.environment).toBe('test');
    expect(response.body.meta.version).toBe('0.1.0');
    expect(response.headers['x-request-id']).toEqual(expect.any(String));
  });

  it('GET /ready succeeds when optional dependencies are not configured', async () => {
    const response = await request(buildApp()).get('/ready');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: {
        status: 'ready',
        checks: {
          database: { configured: false, skipped: true, healthy: true },
          redis: { configured: false, skipped: true, healthy: true },
          odoo: { configured: false, skipped: true, healthy: true },
          ai: { configured: false, skipped: true, healthy: true },
        },
      },
    });
  });

  it('GET /ready returns 503 when a configured dependency is down', async () => {
    const app = buildApp({
      database: {
        ping: async () => {
          throw new Error('ECONNREFUSED');
        },
      },
    });

    const response = await request(app).get('/ready');

    expect(response.status).toBe(503);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe(ERROR_CODES.NOT_READY);
    expect(response.body.error.details.checks.database.healthy).toBe(false);
    expect(response.body.requestId).toEqual(expect.any(String));
  });

  it('GET /ready succeeds when configured dependencies are healthy', async () => {
    const app = buildApp({
      database: { ping: async () => undefined },
      redis: { ping: async () => undefined },
    });

    const response = await request(app).get('/ready');
    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('ready');
    expect(response.body.data.checks.database.configured).toBe(true);
    expect(response.body.data.checks.redis.configured).toBe(true);
    expect(response.body.data.checks.odoo.skipped).toBe(true);
    expect(response.body.data.checks.ai.skipped).toBe(true);
  });

  it('GET /ready returns 503 when configured Odoo is down', async () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      APP_NAME: 'Hackathon Starter Kit',
      ODOO_ENABLED: 'true',
      ODOO_BASE_URL: 'https://odoo.example.com',
      ODOO_DATABASE: 'company',
      ODOO_API_KEY: 'test-key',
    });
    const app = createApp({
      config,
      logger,
      odoo: {
        ping: async () => {
          throw new Error('Invalid apikey');
        },
      },
    }).app;

    const response = await request(app).get('/ready');
    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe(ERROR_CODES.NOT_READY);
    expect(response.body.error.details.checks.odoo.healthy).toBe(false);
  });

  it('GET /ready returns 503 when configured AI is down', async () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      APP_NAME: 'Hackathon Starter Kit',
      AI_ENABLED: 'true',
      AI_PROVIDER: 'gemini',
      GEMINI_API_KEY: 'test-key',
    });
    const app = createApp({
      config,
      logger,
      ai: {
        ping: async () => {
          throw new Error('AI provider authentication failed');
        },
      },
    }).app;

    const response = await request(app).get('/ready');
    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe(ERROR_CODES.NOT_READY);
    expect(response.body.error.details.checks.ai.healthy).toBe(false);
  });

  it('GET /ready reports healthy AI when the mock provider is enabled', async () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      APP_NAME: 'Hackathon Starter Kit',
      AI_ENABLED: 'true',
      AI_PROVIDER: 'mock',
      DEMO_MODE: 'true',
    });
    const app = createApp({ config, logger }).app;

    const response = await request(app).get('/ready');
    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('ready');
    expect(response.body.data.checks.ai).toMatchObject({
      configured: true,
      healthy: true,
      skipped: false,
    });
  });

  it('GET /api/v1/odoo/health requires authentication', async () => {
    const response = await request(buildApp()).get('/api/v1/odoo/health');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe(ERROR_CODES.AUTHENTICATION_ERROR);
  });

  it('GET /api/v1/ai/health requires authentication', async () => {
    const response = await request(buildApp()).get('/api/v1/ai/health');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe(ERROR_CODES.AUTHENTICATION_ERROR);
  });

  it('POST /api/v1/ai/generate requires authentication', async () => {
    const response = await request(buildApp()).post('/api/v1/ai/generate').send({ prompt: 'Hello' });
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe(ERROR_CODES.AUTHENTICATION_ERROR);
  });

  it('POST /api/v1/ai/structured requires authentication', async () => {
    const response = await request(buildApp()).post('/api/v1/ai/structured').send({ prompt: 'Classify this' });
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe(ERROR_CODES.AUTHENTICATION_ERROR);
  });

  it('GET /api/v1 returns API metadata in the standard envelope', async () => {
    const response = await request(buildApp()).get('/api/v1');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: {
        name: 'Hackathon Starter Kit',
        version: 'v1',
        status: 'ok',
      },
      meta: {},
    });
  });

  it('GET /api/v1/jobs/:jobId requires authentication', async () => {
    const response = await request(buildApp()).get(
      '/api/v1/jobs/00000000-0000-4000-8000-000000000001',
    );

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe(ERROR_CODES.AUTHENTICATION_ERROR);
  });

  it('unknown routes use the standard error envelope', async () => {
    const response = await request(buildApp()).get('/does-not-exist');

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe(ERROR_CODES.NOT_FOUND);
    expect(response.body.requestId).toEqual(expect.any(String));
  });

  it('reuses an incoming x-request-id header', async () => {
    const response = await request(buildApp()).get('/health').set('x-request-id', 'fixed-id');
    expect(response.headers['x-request-id']).toBe('fixed-id');
  });

  it('rejects malformed JSON with VALIDATION_ERROR and no stack', async () => {
    const response = await request(buildApp())
      .post('/api/v1/auth/register')
      .set('content-type', 'application/json')
      .send('{"email":');

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    expect(response.body.error.message).toBe('Malformed JSON body');
    expect(response.body.requestId).toEqual(expect.any(String));
    expect(JSON.stringify(response.body)).not.toMatch(/stack/i);
    expect(JSON.stringify(response.body)).not.toContain('{"email":');
  });

  it('rejects invalid request bodies with issue details', async () => {
    const response = await request(buildApp()).post('/api/v1/auth/register').send({
      email: 'not-an-email',
      password: 'secret',
      displayName: 'Ada',
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    expect(response.body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'body.email',
        }),
      ]),
    );
    expect(JSON.stringify(response.body)).not.toContain('secret');
  });

  it('ignores malformed incoming request IDs', async () => {
    const response = await request(buildApp()).get('/health').set('x-request-id', 'not a valid id');
    expect(response.headers['x-request-id']).not.toBe('not a valid id');
    expect(response.headers['x-request-id']).toEqual(expect.any(String));
  });
});
