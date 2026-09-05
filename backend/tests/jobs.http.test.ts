import pino from 'pino';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';

import { createApp } from '../src/app';
import { loadConfig } from '../src/config';
import { ERROR_CODES } from '../src/constants';
import { createJobQueue } from '../src/jobs';
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

describeDatabase('Job status API (database)', () => {
  let database!: DatabaseClient;
  let app!: ReturnType<typeof createApp>['app'];
  const jobs = createJobQueue();

  beforeAll(async () => {
    database = createDatabaseClient({
      url: process.env.DATABASE_URL as string,
      poolMax: 5,
      poolTimeoutSeconds: 10,
    });
    jobs.process('demo', async () => undefined);
    app = createApp({
      config: loadConfig({
        ...AUTH_TEST_ENV,
        DATABASE_URL: process.env.DATABASE_URL,
        AUTH_DEFAULT_ROLE: ROLES.USER,
      }),
      logger,
      database,
      jobs,
    }).app;
  });

  beforeEach(async () => {
    await resetDatabase();
    await seedRbacCatalog(getTestPrisma());
  });

  afterAll(async () => {
    await jobs.close();
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

  it('returns safe status for a completed job', async () => {
    const manager = await asManager('jobs-manager@example.com');
    const jobId = await jobs.enqueue('demo', { ok: true });
    await jobs.waitForIdle();

    const response = await request(app)
      .get(`/api/v1/jobs/${jobId}`)
      .set(authHeader(manager.tokens.accessToken));

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      jobId,
      type: 'demo',
      status: 'completed',
      attempts: 1,
      progress: 100,
      error: null,
    });
    expect(response.body.data).not.toHaveProperty('payload');
  });

  it('does not let another manager read an owned job', async () => {
    const owner = await asManager('jobs-owner@example.com');
    const other = await asManager('jobs-other@example.com');
    const jobId = await jobs.enqueue('demo', { userId: owner.user.id });
    await jobs.waitForIdle();

    const hidden = await request(app)
      .get(`/api/v1/jobs/${jobId}`)
      .set(authHeader(other.tokens.accessToken));
    expect(hidden.status).toBe(404);
    expect(hidden.body.error.code).toBe(ERROR_CODES.NOT_FOUND);

    const visible = await request(app)
      .get(`/api/v1/jobs/${jobId}`)
      .set(authHeader(owner.tokens.accessToken));
    expect(visible.status).toBe(200);
    expect(visible.body.data.jobId).toBe(jobId);
    expect(visible.body.data).not.toHaveProperty('createdBy');
  });

  it('returns 404 for an unknown job and 403 without jobs.read', async () => {
    const user = await register('jobs-user@example.com');
    const manager = await asManager('jobs-manager-2@example.com');

    const forbidden = await request(app)
      .get('/api/v1/jobs/00000000-0000-4000-8000-000000000099')
      .set(authHeader(user.tokens.accessToken));
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe(ERROR_CODES.AUTHORIZATION_ERROR);

    const missing = await request(app)
      .get('/api/v1/jobs/00000000-0000-4000-8000-000000000099')
      .set(authHeader(manager.tokens.accessToken));
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe(ERROR_CODES.NOT_FOUND);
  });
});
