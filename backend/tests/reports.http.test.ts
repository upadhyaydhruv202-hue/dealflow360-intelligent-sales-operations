import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import pino from 'pino';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';

import { createApp } from '../src/app';
import { loadConfig } from '../src/config';
import { ERROR_CODES } from '../src/constants';
import { createDatabaseClient, type DatabaseClient } from '../src/lib/database';
import { ROLES } from '../src/rbac/catalog';
import { seedRbacCatalog } from '../src/rbac/seed-catalog';
import { AUTH_TEST_ENV } from './helpers/auth';
import {
  describeDatabase,
  disconnectTestPrisma,
  getTestPrisma,
  getTestRepositories,
  resetDatabase,
} from './helpers/database';

const logger = pino({ level: 'silent' });
const VALID_PASSWORD = 'correct-horse';

describeDatabase('Reports HTTP (database)', () => {
  let database!: DatabaseClient;
  let app!: ReturnType<typeof createApp>['app'];
  let jobs!: ReturnType<typeof createApp>['jobs'];
  let storageRoot = '';

  beforeAll(async () => {
    storageRoot = await mkdtemp(path.join(os.tmpdir(), 'hsk-reports-http-'));
    database = createDatabaseClient({
      url: process.env.DATABASE_URL as string,
      poolMax: 5,
      poolTimeoutSeconds: 10,
    });
    const created = createApp({
      config: loadConfig({
        ...AUTH_TEST_ENV,
        DATABASE_URL: process.env.DATABASE_URL,
        AUTH_DEFAULT_ROLE: ROLES.USER,
        STORAGE_LOCAL_DIR: storageRoot,
        DEMO_MODE: 'true',
      }),
      logger,
      database,
    });
    app = created.app;
    jobs = created.jobs;
  });

  beforeEach(async () => {
    await resetDatabase();
    await seedRbacCatalog(getTestPrisma());
  });

  afterAll(async () => {
    await database.close();
    await disconnectTestPrisma();
    if (storageRoot) {
      await rm(storageRoot, { recursive: true, force: true });
    }
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
      tokens: { accessToken: string };
    };
  }

  async function asManager(email: string) {
    const session = await register(email);
    const role = await getTestRepositories().roles.findByNameOrThrow(ROLES.MANAGER);
    await getTestRepositories().roles.assignUser(session.user.id, role.id);
    return session;
  }

  function authHeader(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  it('lists report types and generates a table report synchronously', async () => {
    const user = await register('report-user@example.com');
    const manager = await asManager('report-manager@example.com');

    const denied = await request(app)
      .post('/api/v1/reports/generate')
      .set(authHeader(user.tokens.accessToken))
      .send({ type: 'simple', data: { title: 'Nope' }, options: { async: false } });
    expect(denied.status).toBe(403);

    const types = await request(app)
      .get('/api/v1/reports/types')
      .set(authHeader(manager.tokens.accessToken));
    expect(types.status).toBe(200);
    expect(types.body.data.types.map((item: { type: string }) => item.type)).toEqual(
      expect.arrayContaining(['simple', 'table', 'summary', 'document']),
    );

    const generated = await request(app)
      .post('/api/v1/reports/generate')
      .set(authHeader(manager.tokens.accessToken))
      .send({
        type: 'table',
        data: {
          title: 'Inventory snapshot',
          columns: ['Sku', 'Qty'],
          rows: [['A-1', 4]],
        },
        options: { async: false },
      });
    expect(generated.status).toBe(200);
    expect(generated.body.data.contentType).toBe('application/pdf');
    expect(generated.body.data.download.url).toContain('/api/v1/storage/download');
  });

  it('queues report generation by default and rejects missing data', async () => {
    const manager = await asManager('report-async@example.com');

    const missing = await request(app)
      .post('/api/v1/reports/generate')
      .set(authHeader(manager.tokens.accessToken))
      .send({ type: 'table', data: { title: 'No rows' } });
    expect(missing.status).toBe(400);
    expect(missing.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);

    const queued = await request(app)
      .post('/api/v1/reports/generate')
      .set(authHeader(manager.tokens.accessToken))
      .send({
        type: 'simple',
        data: { title: 'Async report', sections: [{ lines: ['Queued work'] }] },
      });
    expect(queued.status).toBe(202);
    expect(queued.body.data).toEqual({
      jobId: expect.any(String),
      status: 'queued',
    });

    await jobs.waitForIdle();
    const status = await request(app)
      .get(`/api/v1/jobs/${queued.body.data.jobId}`)
      .set(authHeader(manager.tokens.accessToken));
    expect(status.status).toBe(200);
    expect(status.body.data.status).toBe('completed');
  });
});
