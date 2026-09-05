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
const REFUND_POLICY = [
  'Refund policy for late shipments.',
  'Customers may request a refund within 14 days of delivery when a shipment arrives late.',
  'Refunds are issued to the original payment method.',
].join(' ');

describeDatabase('RAG HTTP (database / postgres vector store)', () => {
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
        FEATURE_RAG: 'true',
        AI_PROVIDER: 'mock',
        DEMO_MODE: 'true',
        AUTH_DEFAULT_ROLE: ROLES.USER,
        RAG_MIN_SCORE: '0.15',
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

  it('indexes into Postgres, searches, answers with sources, and deletes', async () => {
    const { tokens } = await asManager('rag-manager@example.com');
    const auth = { Authorization: `Bearer ${tokens.accessToken}` };

    const indexed = await request(app).post('/api/v1/rag/index').set(auth).send({
      documentId: 'refund-policy',
      source: 'Refund policy',
      text: REFUND_POLICY,
    });
    expect(indexed.status).toBe(201);
    expect(indexed.body.data.status).toBe('indexed');
    expect(indexed.body.data.chunkCount).toBeGreaterThan(0);

    const stored = await request(app).get('/api/v1/rag/documents/refund-policy').set(auth);
    expect(stored.status).toBe(200);
    expect(stored.body.data.documentId).toBe('refund-policy');

    const search = await request(app).post('/api/v1/rag/search').set(auth).send({
      query: 'When can a customer request a refund for a late shipment?',
    });
    expect(search.status).toBe(200);
    expect(search.body.data.chunks[0].documentId).toBe('refund-policy');

    const asked = await request(app).post('/api/v1/rag/ask').set(auth).send({
      query: 'What is the refund window for a late shipment?',
    });
    expect(asked.status).toBe(200);
    expect(asked.body.data.grounded).toBe(true);
    expect(asked.body.data.sources[0].documentId).toBe('refund-policy');

    const removed = await request(app).delete('/api/v1/rag/documents/refund-policy').set(auth);
    expect(removed.status).toBe(200);

    const missing = await request(app).get('/api/v1/rag/documents/refund-policy').set(auth);
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe(ERROR_CODES.NOT_FOUND);
  });

  it('does not let another manager search a private index', async () => {
    const owner = await asManager('rag-owner@example.com');
    const other = await asManager('rag-other@example.com');

    const indexed = await request(app)
      .post('/api/v1/rag/index')
      .set({ Authorization: `Bearer ${owner.tokens.accessToken}` })
      .send({
        documentId: 'owner-policy',
        source: 'Refund policy',
        text: REFUND_POLICY,
      });
    expect(indexed.status).toBe(201);

    const search = await request(app)
      .post('/api/v1/rag/search')
      .set({ Authorization: `Bearer ${other.tokens.accessToken}` })
      .send({ query: 'refund window for a late shipment' });
    expect(search.status).toBe(200);
    expect(search.body.data.chunks).toEqual([]);

    const hidden = await request(app)
      .get('/api/v1/rag/documents/owner-policy')
      .set({ Authorization: `Bearer ${other.tokens.accessToken}` });
    expect(hidden.status).toBe(404);
    expect(hidden.body.error.code).toBe(ERROR_CODES.NOT_FOUND);
  });

  it('forbids a user without rag.use', async () => {
    const { tokens } = await register('rag-user@example.com');
    const response = await request(app)
      .post('/api/v1/rag/search')
      .set({ Authorization: `Bearer ${tokens.accessToken}` })
      .send({ query: 'refund' });
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe(ERROR_CODES.AUTHORIZATION_ERROR);
  });
});
