import express from 'express';
import pino from 'pino';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { ERROR_CODES } from '../constants';
import {
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  DatabaseError,
  ExternalServiceError,
  NotFoundError,
  RateLimitError,
  TimeoutError,
  ValidationError,
} from '../errors';
import { idParamsSchema, paginationQuerySchema } from '../schemas/common';
import { asyncHandler } from '../utils/async-handler';
import { errorHandler } from './error-handler';
import { requestIdMiddleware } from './request-id';
import { validate } from './validate';

const logger = pino({ level: 'silent' });

function buildApp(isProduction = true) {
  const app = express();
  app.use(requestIdMiddleware);
  app.use(express.json({ limit: '1kb' }));
  app.get('/boom', () => {
    throw new Error('secret stack at D:\\app\\src\\service.ts api-key=abcd');
  });
  app.get('/async-boom', asyncHandler(async () => {
    throw new Error('async failure');
  }));
  app.get('/validation', () => {
    throw new ValidationError('Invalid request', [
      { path: 'body.email', message: 'Invalid email', code: 'invalid_string' },
    ]);
  });
  app.get('/authn', () => {
    throw new AuthenticationError();
  });
  app.get('/authz', () => {
    throw new AuthorizationError();
  });
  app.get('/missing', () => {
    throw new NotFoundError();
  });
  app.get('/conflict', () => {
    throw new ConflictError();
  });
  app.get('/limited', () => {
    throw new RateLimitError();
  });
  app.get('/provider', () => {
    throw new ExternalServiceError('Odoo failed', { apiKey: 'should-hide', provider: 'odoo' });
  });
  app.get('/database', () => {
    throw new DatabaseError('connection to D:\\postgres failed', { password: 's3cret' });
  });
  app.get('/timeout', () => {
    throw new TimeoutError();
  });
  app.get(
    '/items',
    validate({ query: paginationQuerySchema }),
    (req, res) => {
      res.json({ query: req.query });
    },
  );
  app.get(
    '/items/:id',
    validate({ params: idParamsSchema }),
    (req, res) => {
      res.json({ id: req.params.id });
    },
  );
  app.post(
    '/echo',
    validate({ body: z.object({ name: z.string().min(1) }) }),
    (req, res) => {
      res.json({ name: req.body.name });
    },
  );
  app.use(errorHandler(logger, isProduction));
  return app;
}

describe('errorHandler', () => {
  it('maps each normalized error type to the standard envelope', async () => {
    const app = buildApp();
    const cases = [
      ['/validation', 400, ERROR_CODES.VALIDATION_ERROR],
      ['/authn', 401, ERROR_CODES.AUTHENTICATION_ERROR],
      ['/authz', 403, ERROR_CODES.AUTHORIZATION_ERROR],
      ['/missing', 404, ERROR_CODES.NOT_FOUND],
      ['/conflict', 409, ERROR_CODES.CONFLICT],
      ['/limited', 429, ERROR_CODES.RATE_LIMIT],
      ['/provider', 502, ERROR_CODES.EXTERNAL_SERVICE_ERROR],
      ['/database', 503, ERROR_CODES.DATABASE_ERROR],
      ['/timeout', 504, ERROR_CODES.TIMEOUT],
    ] as const;

    for (const [path, status, code] of cases) {
      const response = await request(app).get(path);
      expect(response.status, path).toBe(status);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe(code);
      expect(response.body.requestId).toEqual(expect.any(String));
      expect(JSON.stringify(response.body)).not.toMatch(/stack/i);
    }
  });

  it('never exposes stack traces, secrets, or filesystem paths for unhandled errors', async () => {
    const response = await request(buildApp()).get('/boom');
    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe(ERROR_CODES.INTERNAL_ERROR);
    expect(response.body.error.message).toBe('An unexpected error occurred');
    expect(response.body.error.details).toEqual({});
    expect(JSON.stringify(response.body)).not.toContain('D:');
    expect(JSON.stringify(response.body)).not.toContain('api-key');
    expect(JSON.stringify(response.body)).not.toContain('secret stack');
  });

  it('handles async controller failures through asyncHandler', async () => {
    const response = await request(buildApp()).get('/async-boom');
    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe(ERROR_CODES.INTERNAL_ERROR);
    expect(response.body.error.message).toBe('An unexpected error occurred');
  });

  it('uses a generic message for 5xx AppErrors in production', async () => {
    const response = await request(buildApp(true)).get('/database');
    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe(ERROR_CODES.DATABASE_ERROR);
    expect(response.body.error.message).toBe('An unexpected error occurred');
    expect(response.body.error.details).toEqual({});
    expect(JSON.stringify(response.body)).not.toContain('D:');
  });

  it('redacts secrets in operational error details', async () => {
    const response = await request(buildApp(false)).get('/provider');
    expect(response.status).toBe(502);
    expect(response.body.error.details.apiKey).toBe('[Redacted]');
    expect(response.body.error.details.provider).toBe('odoo');
  });

  it('returns validation issues as an array', async () => {
    const response = await request(buildApp()).get('/validation');
    expect(response.body.error.details).toEqual([
      { path: 'body.email', message: 'Invalid email', code: 'invalid_string' },
    ]);
  });
});

describe('validate middleware', () => {
  it('rejects malformed query and path values', async () => {
    const app = buildApp();
    const query = await request(app).get('/items').query({ page: '0' });
    expect(query.status).toBe(400);
    expect(query.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    expect(query.body.error.details[0].path).toMatch(/query/);

    const path = await request(app).get('/items/not-a-uuid');
    expect(path.status).toBe(400);
    expect(path.body.error.details[0].path).toMatch(/params/);
  });

  it('rejects invalid bodies and accepts valid ones', async () => {
    const app = buildApp();
    const invalid = await request(app).post('/echo').send({ name: '' });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.details[0].path).toBe('body.name');

    const valid = await request(app).post('/echo').send({ name: 'ok' });
    expect(valid.status).toBe(200);
    expect(valid.body.name).toBe('ok');
  });
});
