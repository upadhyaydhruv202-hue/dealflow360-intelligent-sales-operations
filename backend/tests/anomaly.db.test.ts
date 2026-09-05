import pino from 'pino';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';

import { createApp } from '../src/app';
import { loadConfig } from '../src/config';
import { HIGH_DROP_SALES } from '../src/anomaly/fixtures';
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

describeDatabase('Anomaly HTTP (database)', () => {
  let database!: DatabaseClient;
  let app!: ReturnType<typeof createApp>['app'];

  beforeAll(async () => {
    database = createDatabaseClient({
      url: process.env.DATABASE_URL as string,
      poolMax: 5,
      poolTimeoutSeconds: 10,
    });
    app = createApp({
      config: loadConfig({
        ...AUTH_TEST_ENV,
        DATABASE_URL: process.env.DATABASE_URL,
        AI_ENABLED: 'true',
        FEATURE_AI: 'true',
        FEATURE_ANOMALY_DETECTION: 'true',
        AI_PROVIDER: 'mock',
        DEMO_MODE: 'true',
        AUTH_DEFAULT_ROLE: ROLES.USER,
      }),
      logger,
      database,
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
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({
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

  it('persists a finding and lists it', async () => {
    const { tokens } = await asManager('anomaly.manager@example.com');
    const auth = { Authorization: `Bearer ${tokens.accessToken}` };

    const evaluated = await request(app).post('/api/v1/anomalies/evaluate').set(auth).send({
      metric: 'sales',
      points: HIGH_DROP_SALES,
      explain: false,
    });
    expect(evaluated.status).toBe(200);
    expect(evaluated.body.data.anomaly).toBe(true);

    const listed = await request(app).get('/api/v1/anomalies').set(auth);
    expect(listed.status).toBe(200);
    expect(listed.body.data.items[0].id).toBe(evaluated.body.data.id);

    const fetched = await request(app).get(`/api/v1/anomalies/${evaluated.body.data.id}`).set(auth);
    expect(fetched.status).toBe(200);
    expect(fetched.body.data.metric).toBe('sales');
  });

  it('does not let another manager read a private finding', async () => {
    const owner = await asManager('anomaly.owner@example.com');
    const other = await asManager('anomaly.other@example.com');

    const evaluated = await request(app)
      .post('/api/v1/anomalies/evaluate')
      .set({ Authorization: `Bearer ${owner.tokens.accessToken}` })
      .send({
        metric: 'sales',
        points: HIGH_DROP_SALES,
        explain: false,
      });
    expect(evaluated.status).toBe(200);
    const id = evaluated.body.data.id as string;

    const listed = await request(app)
      .get('/api/v1/anomalies')
      .set({ Authorization: `Bearer ${other.tokens.accessToken}` });
    expect(listed.status).toBe(200);
    expect(listed.body.data.items).toEqual([]);

    const fetched = await request(app)
      .get(`/api/v1/anomalies/${id}`)
      .set({ Authorization: `Bearer ${other.tokens.accessToken}` });
    expect(fetched.status).toBe(404);
    expect(fetched.body.error.code).toBe(ERROR_CODES.NOT_FOUND);
  });

  it('denies a user without anomaly.use', async () => {
    const { tokens } = await register('anomaly.user@example.com');
    const response = await request(app)
      .post('/api/v1/anomalies/evaluate')
      .set({ Authorization: `Bearer ${tokens.accessToken}` })
      .send({ metric: 'sales', points: HIGH_DROP_SALES });
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe(ERROR_CODES.AUTHORIZATION_ERROR);
  });
});
