import pino from 'pino';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';

import { createApp } from '../src/app';
import { loadConfig } from '../src/config';
import { createDatabaseClient, type DatabaseClient } from '../src/lib/database';
import { ROLES } from '../src/rbac/catalog';
import { seedRbacCatalog } from '../src/rbac/seed-catalog';
import { AUTH_TEST_ENV } from './helpers/auth';
import {
  describeDatabase,
  disconnectTestPrisma,
  getTestPrisma,
  resetDatabase,
} from './helpers/database';

const logger = pino({ level: 'silent' });
const VALID_PASSWORD = 'correct-horse';

describeDatabase('Analytics HTTP (database / postgres provider)', () => {
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
        FEATURE_ANALYTICS: 'true',
        ANALYTICS_PROVIDER: 'postgres',
        DEMO_MODE: 'false',
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
    const prisma = getTestPrisma();
    const manager = await prisma.role.findUniqueOrThrow({ where: { name: ROLES.MANAGER } });
    await prisma.userRole.create({
      data: { userId: session.user.id, roleId: manager.id },
    });
    return { Authorization: `Bearer ${session.tokens.accessToken}` };
  }

  it(
    'ingests into Postgres, aggregates with filters, and returns a time series',
    async () => {
      const auth = await asManager('analytics.manager@example.com');
      const ingested = await request(app).post('/api/v1/analytics/facts').set(auth).send({
        facts: [
          {
            kpi: 'kit.demo.events',
            eventId: 'pg-a',
            occurredAt: '2026-09-01T10:00:00.000Z',
            value: 1,
            dimensions: { status: 'open', category: 'ops' },
          },
          {
            kpi: 'kit.demo.events',
            eventId: 'pg-b',
            occurredAt: '2026-09-02T10:00:00.000Z',
            value: 1,
            dimensions: { status: 'closed', category: 'ops' },
          },
        ],
      });
      expect(ingested.status).toBe(201);

      const snapshot = await request(app).post('/api/v1/analytics/query').set(auth).send({
        kpi: 'kit.demo.events',
        kind: 'snapshot',
        from: '2026-09-01T00:00:00.000Z',
        to: '2026-09-03T00:00:00.000Z',
        filters: [{ field: 'status', operator: 'eq', value: 'open' }],
      });
      expect(snapshot.status).toBe(200);
      expect(snapshot.body.data.snapshot.value).toBe(1);

      const series = await request(app).post('/api/v1/analytics/query').set(auth).send({
        kpi: 'kit.demo.events',
        kind: 'timeseries',
        granularity: 'day',
        from: '2026-09-01T00:00:00.000Z',
        to: '2026-09-03T00:00:00.000Z',
      });
      expect(series.status).toBe(200);
      expect(series.body.data.points.length).toBeGreaterThan(0);
    },
    20_000,
  );

  it('does not let a user without analytics.read query', async () => {
    const session = await register('analytics.user@example.com');
    const response = await request(app)
      .post('/api/v1/analytics/query')
      .set({ Authorization: `Bearer ${session.tokens.accessToken}` })
      .send({ kpi: 'kit.demo.events' });
    expect(response.status).toBe(403);
  });
});
