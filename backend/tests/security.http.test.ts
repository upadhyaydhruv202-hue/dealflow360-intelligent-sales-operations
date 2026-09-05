import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import express from 'express';
import pino from 'pino';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { AuditService, createMemoryAuditStore } from '../src/audit';
import type { AuthenticatedUser } from '../src/auth/types';
import { createApp } from '../src/app';
import { loadConfig } from '../src/config';
import { ERROR_CODES } from '../src/constants';
import { CopilotController } from '../src/controllers/copilot.controller';
import { DocumentController } from '../src/controllers/document.controller';
import {
  createCopilotService,
  createCopilotToolRegistry,
  createMemoryCopilotConversations,
  defineCopilotTool,
} from '../src/copilot';
import { createAiService } from '../src/integrations/ai';
import { createTestService, silentLogger } from '../src/integrations/ai/ai.test-helpers';
import { createDocumentIntelligenceService } from '../src/integrations/documents';
import { LocalStorageProvider } from '../src/integrations/storage/providers/local.provider';
import { StorageService } from '../src/integrations/storage/storage.service';
import { createJobQueue } from '../src/jobs';
import { createDatabaseClient, type DatabaseClient } from '../src/lib/database';
import { errorHandler, requestIdMiddleware } from '../src/middleware';
import { FixedOtpGenerator } from '../src/otp';
import { PERMISSIONS } from '../src/rbac/catalog';
import { seedRbacCatalog } from '../src/rbac/seed-catalog';
import { createCopilotRouter } from '../src/routes/copilot.routes';
import { createDocumentRouter } from '../src/routes/document.routes';
import { AUTH_TEST_ENV } from './helpers/auth';
import {
  describeDatabase,
  disconnectTestPrisma,
  getTestPrisma,
  resetDatabase,
} from './helpers/database';
import { MemoryDocumentRepository } from './helpers/memory-documents';

const logger = pino({ level: 'silent' });
const VALID_PASSWORD = 'correct-horse';

function baseEnv(overrides: Record<string, string> = {}) {
  return loadConfig({
    ...AUTH_TEST_ENV,
    REQUEST_BODY_LIMIT: '2kb',
    ...overrides,
  });
}

describe('Security HTTP (no database)', () => {
  const app = createApp({
    config: baseEnv(),
    logger,
  }).app;

  it('sets secure HTTP headers and hides the stack', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('DENY');
    expect(response.headers['referrer-policy']).toBe('no-referrer');
    expect(response.headers['content-security-policy']).toMatch(/default-src 'none'/);
    expect(response.headers['x-powered-by']).toBeUndefined();
    expect(JSON.stringify(response.body)).not.toMatch(/stack/i);
  });

  it('does not reflect disallowed CORS origins', async () => {
    const response = await request(app).get('/health').set('Origin', 'https://evil.example');
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('allows configured CORS origins', async () => {
    const response = await request(app).get('/health').set('Origin', 'http://localhost:5173');
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('rejects unauthorized requests to protected APIs', async () => {
    const response = await request(app).get('/api/v1/auth/me');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe(ERROR_CODES.AUTHENTICATION_ERROR);
  });

  it('rejects a malformed bearer token', async () => {
    const response = await request(app).get('/api/v1/auth/me').set('Authorization', 'Bearer not.a.jwt');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe(ERROR_CODES.AUTHENTICATION_ERROR);
    expect(JSON.stringify(response.body)).not.toMatch(/stack/i);
  });

  it('rejects an oversized JSON body', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .set('content-type', 'application/json')
      .send(`{"email":"ada@example.com","password":"${'a'.repeat(4000)}","displayName":"Ada"}`);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    expect(response.body.error.message).toMatch(/too large/i);
  });
});

describe('Security HTTP — copilot tool allowlist', () => {
  it('denies an unauthorized AI tool instead of executing it', async () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      FEATURE_COPILOT: 'true',
      AI_ENABLED: 'true',
      AI_PROVIDER: 'mock',
      DEMO_MODE: 'true',
    });
    const { service: ai, provider } = createTestService();
    const copilot = createCopilotService({
      config,
      logger: silentLogger,
      ai,
      registry: createCopilotToolRegistry([
        defineCopilotTool({
          name: 'echoLookup',
          description: 'Echo a demo id',
          requiredPermission: PERMISSIONS.COPILOT_USE,
          riskLevel: 'low',
          inputSchema: z.object({ id: z.string().min(1).max(64) }),
          handler: async (input: { id: string }) => ({ id: input.id }),
        }),
      ]),
      conversations: createMemoryCopilotConversations(),
      audit: new AuditService(createMemoryAuditStore()),
    });
    const user: AuthenticatedUser = {
      id: '11111111-1111-1111-1111-111111111111',
      email: 'manager@example.com',
      displayName: 'Manager',
      status: 'active',
      role: 'manager',
      roles: ['manager'],
      permissions: [PERMISSIONS.COPILOT_USE],
    };
    const app = express();
    app.use(requestIdMiddleware);
    app.use(express.json());
    app.use(
      '/api/v1',
      createCopilotRouter({
        controller: new CopilotController(copilot),
        authenticate: (req, _res, next) => {
          req.user = user;
          next();
        },
      }),
    );
    app.use(errorHandler(pino({ level: 'silent' }), true));

    provider.enqueue(
      JSON.stringify({
        intent: 'tool',
        reply: 'Running SQL',
        tools: [{ name: 'executeSql', arguments: { sql: 'DROP TABLE users' } }],
        confidence: 0.9,
      }),
    );

    const response = await request(app).post('/api/v1/copilot/chat').send({ message: 'delete everything' });
    expect(response.status).toBe(200);
    expect(response.body.data.tools[0]).toMatchObject({
      name: 'executeSql',
      status: 'denied',
      error: 'Tool is not in the allowlist',
    });
  });
});

describe('Security HTTP — uploads', () => {
  it('rejects a malicious filename and oversized upload', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'hsk-sec-upload-'));
    try {
      const config = loadConfig({
        NODE_ENV: 'test',
        AI_ENABLED: 'true',
        AI_PROVIDER: 'mock',
        DEMO_MODE: 'true',
        DOCUMENT_MAX_BYTES: '64',
        STORAGE_LOCAL_DIR: root,
      });
      const service = createDocumentIntelligenceService({
        config,
        logger,
        documents: new MemoryDocumentRepository(),
        storage: new StorageService(new LocalStorageProvider(root)),
        ai: createAiService({ config, logger }),
        jobs: createJobQueue(),
      });
      const user: AuthenticatedUser = {
        id: '11111111-1111-4111-8111-111111111111',
        email: 'manager@example.com',
        displayName: 'Manager',
        status: 'active',
        role: 'manager',
        roles: ['manager'],
        permissions: [PERMISSIONS.DOCUMENTS_ANALYZE, PERMISSIONS.DOCUMENTS_READ],
      };
      const app = express();
      app.use(requestIdMiddleware);
      app.use(
        '/api/v1',
        createDocumentRouter({
          controller: new DocumentController(service),
          authenticate: (req, _res, next) => {
            req.user = user;
            next();
          },
          maxBytes: 64,
        }),
      );
      app.use(errorHandler(logger, true));

      const traversal = await request(app)
        .post('/api/v1/documents/analyze')
        .field('documentType', 'generic')
        .attach('file', Buffer.from('hello', 'utf8'), {
          filename: '..passwd.txt',
          contentType: 'text/plain',
        });
      expect(traversal.status).toBe(400);
      expect(traversal.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);

      const oversized = await request(app)
        .post('/api/v1/documents/analyze')
        .field('documentType', 'generic')
        .attach('file', Buffer.alloc(128, 65), { filename: 'big.txt', contentType: 'text/plain' });
      expect(oversized.status).toBe(400);
      expect(oversized.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describeDatabase('Security HTTP', () => {
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
        RATE_LIMIT_ENABLED: 'true',
        RATE_LIMIT_PUBLIC_MAX: '1000',
        RATE_LIMIT_AUTH_MAX: '1000',
        RATE_LIMIT_AUTHENTICATED_MAX: '1000',
        RATE_LIMIT_ADMIN_MAX: '1000',
        RATE_LIMIT_AI_MAX: '1000',
        RATE_LIMIT_UPLOAD_MAX: '1000',
        AUTH_LOGIN_RATE_LIMIT_MAX: '2',
        AUTH_LOGIN_IP_RATE_LIMIT_MAX: '20',
        AUTH_LOGIN_RATE_LIMIT_WINDOW: '15m',
        AUTH_PASSWORD_RESET_RATE_LIMIT_MAX: '3',
        AUTH_PASSWORD_RESET_IP_RATE_LIMIT_MAX: '20',
      }),
      logger,
      database,
      otpGenerator: new FixedOtpGenerator('123456'),
    }).app;
  });

  beforeEach(async () => {
    await resetDatabase();
    await seedRbacCatalog(getTestPrisma());
  });

  afterAll(async () => {
    await database.close();
    await disconnectTestPrisma();
  });

  async function register(email: string) {
    const response = await request(app).post('/api/v1/auth/register').send({
      email,
      password: VALID_PASSWORD,
      displayName: email.split('@')[0],
    });
    expect(response.status).toBe(201);
    return response.body.data as {
      user: { id: string };
      tokens: { accessToken: string; refreshToken: string };
    };
  }

  it('forbids a USER from admin catalog writes', async () => {
    const session = await register('user@example.com');
    const response = await request(app)
      .post('/api/v1/permissions')
      .set('Authorization', `Bearer ${session.tokens.accessToken}`)
      .send({ key: 'secret.read', description: 'nope' });
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe(ERROR_CODES.AUTHORIZATION_ERROR);
  });

  it('rate-limits login brute force', async () => {
    await register('brute@example.com');
    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'brute@example.com', password: 'wrong-password' });
    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'brute@example.com', password: 'wrong-password' });
    const blocked = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'brute@example.com', password: 'wrong-password' });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe(ERROR_CODES.RATE_LIMIT);
  });

  it('rate-limits password reset confirmation', async () => {
    await register('reset@example.com');
    await request(app).post('/api/v1/auth/password-reset/request').send({ email: 'reset@example.com' });
    await request(app)
      .post('/api/v1/auth/password-reset/confirm')
      .send({ email: 'reset@example.com', code: '000000', password: 'new-password' });
    await request(app)
      .post('/api/v1/auth/password-reset/confirm')
      .send({ email: 'reset@example.com', code: '000000', password: 'new-password' });
    const blocked = await request(app)
      .post('/api/v1/auth/password-reset/confirm')
      .send({ email: 'reset@example.com', code: '000000', password: 'new-password' });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe(ERROR_CODES.RATE_LIMIT);
  });

  it('resets a password after a valid OTP and revokes sessions', async () => {
    const session = await register('ada@example.com');
    const requested = await request(app)
      .post('/api/v1/auth/password-reset/request')
      .send({ email: 'ada@example.com' });
    expect(requested.status).toBe(200);
    expect(JSON.stringify(requested.body)).not.toContain('123456');

    const confirmed = await request(app).post('/api/v1/auth/password-reset/confirm').send({
      email: 'ada@example.com',
      code: '123456',
      password: 'brand-new-password',
    });
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.data.reset).toBe(true);

    const refresh = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: session.tokens.refreshToken });
    expect(refresh.status).toBe(401);

    const oldPassword = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'ada@example.com', password: VALID_PASSWORD });
    expect(oldPassword.status).toBe(401);

    const staleAccess = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${session.tokens.accessToken}`);
    expect(staleAccess.status).toBe(401);
    expect(staleAccess.body.error.message).toBe('Token has been revoked');

    const next = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'ada@example.com', password: 'brand-new-password' });
    expect(next.status).toBe(200);

    const nextMe = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${next.body.data.tokens.accessToken}`);
    expect(nextMe.status).toBe(200);
  });

  it('does not reveal whether an email exists during password reset', async () => {
    const missing = await request(app)
      .post('/api/v1/auth/password-reset/request')
      .send({ email: 'nobody@example.com' });
    expect(missing.status).toBe(200);
    expect(missing.body.data.purpose).toBe('password-reset');
  });

  it('rate-limits public authentication routes separately from login', async () => {
    const tight = createApp({
      config: loadConfig({
        ...AUTH_TEST_ENV,
        DATABASE_URL: process.env.DATABASE_URL,
        RATE_LIMIT_ENABLED: 'true',
        RATE_LIMIT_PUBLIC_MAX: '1000',
        RATE_LIMIT_AUTH_MAX: '1',
        RATE_LIMIT_AUTH_WINDOW: '15m',
      }),
      logger,
      database,
    }).app;

    await request(tight).post('/api/v1/auth/register').send({
      email: 'one@example.com',
      password: VALID_PASSWORD,
      displayName: 'One',
    });
    const second = await request(tight).post('/api/v1/auth/register').send({
      email: 'two@example.com',
      password: VALID_PASSWORD,
      displayName: 'Two',
    });
    expect(second.status).toBe(429);
    expect(second.body.error.code).toBe(ERROR_CODES.RATE_LIMIT);
  });
});
