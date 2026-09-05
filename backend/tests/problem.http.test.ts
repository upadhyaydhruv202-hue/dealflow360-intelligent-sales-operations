import pino from 'pino';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/app';
import { loadConfig } from '../src/config';
import { ERROR_CODES } from '../src/constants';
import { createBackgroundWorker } from '../src/jobs/runtime';
import { createDatabaseClient, type DatabaseClient } from '../src/lib/database';
import { loadProblemModule } from '../src/problem';
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
const DEALFLOW_JOB_NAME = 'dealflow.odoo.sync';
const VALID_PASSWORD = 'correct-horse';

function buildApp() {
  const config = loadConfig({
    NODE_ENV: 'test',
    APP_NAME: 'Hackathon Starter Kit',
  });

  return createApp({
    config,
    logger,
  });
}

describe('problem module HTTP registration', () => {
  it('exposes the DealFlow360 manifest without authentication', async () => {
    const { app, problemModule } = buildApp();
    expect(problemModule?.id).toBe(loadProblemModule().id);

    const response = await request(app).get('/api/v1/problem');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: {
        id: 'dealflow',
        replaceable: false,
        jobName: DEALFLOW_JOB_NAME,
      },
    });
  });

  it('protects quote reads with authentication', async () => {
    const { app } = buildApp();
    const response = await request(app).get('/api/v1/dealflow/quotes');

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe(ERROR_CODES.AUTHENTICATION_ERROR);
  });

  it('protects quote writes with authentication', async () => {
    const { app } = buildApp();
    const response = await request(app).post('/api/v1/dealflow/quotes').send({});

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe(ERROR_CODES.AUTHENTICATION_ERROR);
  });
});

describe('problem module worker registration', () => {
  it('registers the DealFlow360 job processor on createApp', async () => {
    const { jobs } = buildApp();
    const jobId = await jobs.enqueue(DEALFLOW_JOB_NAME, {});
    await jobs.waitForIdle();
    const status = await jobs.getJob(jobId);

    expect(status?.type).toBe(DEALFLOW_JOB_NAME);
    expect(status?.status).toBe('completed');
    await jobs.close();
  });

  it('registers the DealFlow360 job processor on the background worker', async () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      APP_NAME: 'Hackathon Starter Kit',
    });
    const worker = createBackgroundWorker({ config, logger });
    const jobId = await worker.jobs.enqueue(DEALFLOW_JOB_NAME, {});
    await worker.jobs.waitForIdle();
    const status = await worker.jobs.getJob(jobId);

    expect(status?.status).toBe('completed');
    await worker.close();
  });
});

describeDatabase('problem module permissions and validation', () => {
  let database!: DatabaseClient;
  let app!: ReturnType<typeof createApp>['app'];
  let jobs!: ReturnType<typeof createApp>['jobs'];

  beforeAll(() => {
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
      user: { id: string; permissions: string[] };
      tokens: { accessToken: string };
    };
  }

  async function assignRole(userId: string, role: string) {
    const roleRecord = await getTestRepositories().roles.findByNameOrThrow(role);
    await getTestRepositories().roles.assignUser(userId, roleRecord.id);
  }

  function authHeader(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  it('seeds DealFlow360 permissions into the catalog', async () => {
    const permission = await getTestPrisma().permission.findUnique({
      where: { key: 'dealflow.quotes.read' },
    });
    expect(permission?.key).toBe('dealflow.quotes.read');
  });

  it('allows STAFF to read quotes and denies USER', async () => {
    const user = await register('problem-user@example.com');
    const staff = await register('problem-staff@example.com');
    await assignRole(staff.user.id, ROLES.STAFF);

    const denied = await request(app)
      .get('/api/v1/dealflow/quotes')
      .set(authHeader(user.tokens.accessToken));
    const allowed = await request(app)
      .get('/api/v1/dealflow/quotes')
      .set(authHeader(staff.tokens.accessToken));

    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe(ERROR_CODES.AUTHORIZATION_ERROR);
    expect(allowed.status).toBe(200);
    expect(Array.isArray(allowed.body.data)).toBe(true);
  });

  it('rejects invalid quote bodies for MANAGER', async () => {
    const manager = await register('problem-manager@example.com');
    await assignRole(manager.user.id, ROLES.MANAGER);

    const invalid = await request(app)
      .post('/api/v1/dealflow/quotes')
      .set(authHeader(manager.tokens.accessToken))
      .send({ customerId: 1 });

    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
  });
});
