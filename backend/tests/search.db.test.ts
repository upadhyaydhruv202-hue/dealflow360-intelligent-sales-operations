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

describeDatabase('Search HTTP (database / postgres provider)', () => {
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
        FEATURE_SEARCH: 'true',
        SEARCH_PROVIDER: 'postgres',
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
    const prisma = getTestPrisma();
    const manager = await prisma.role.findUniqueOrThrow({ where: { name: ROLES.MANAGER } });
    await prisma.userRole.create({
      data: { userId: session.user.id, roleId: manager.id },
    });
    return { Authorization: `Bearer ${session.tokens.accessToken}` };
  }

  it(
    'indexes into Postgres, searches with full-text, filters, and fuzzy',
    async () => {
    const auth = await asManager('search.manager@example.com');
    const indexed = await request(app).post('/api/v1/search/documents').set(auth).send({
      index: 'kit.demo',
      documentId: 'custom-policy',
      title: 'Customer refund desk',
      body: 'Late parcels qualify for a refund when the carrier misses the SLA.',
      fields: { status: 'published', category: 'policy' },
    });
    expect(indexed.status).toBe(201);

    const fulltext = await request(app).post('/api/v1/search').set(auth).send({
      query: 'late parcels refund',
      mode: 'fulltext',
      filters: [{ field: 'status', operator: 'eq', value: 'published' }],
    });
    expect(fulltext.status).toBe(200);
    expect(
      fulltext.body.data.hits.some((hit: { documentId: string }) => hit.documentId === 'custom-policy'),
    ).toBe(true);

    const fuzzy = await request(app).post('/api/v1/search').set(auth).send({
      query: 'refnd',
      mode: 'fuzzy',
    });
    expect(fuzzy.status).toBe(200);
    expect(fuzzy.body.data.hits.length).toBeGreaterThan(0);
    },
    20_000,
  );

  it('does not let a user without search.use query', async () => {
    const session = await register('search.user@example.com');
    const response = await request(app)
      .post('/api/v1/search')
      .set({ Authorization: `Bearer ${session.tokens.accessToken}` })
      .send({ query: 'refund' });
    expect(response.status).toBe(403);
  });
});
