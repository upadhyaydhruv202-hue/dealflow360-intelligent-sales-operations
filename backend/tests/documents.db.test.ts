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

describeDatabase('Document intelligence HTTP (database)', () => {
  let database!: DatabaseClient;
  let app!: ReturnType<typeof createApp>['app'];
  let storageRoot = '';

  beforeAll(async () => {
    storageRoot = await mkdtemp(path.join(os.tmpdir(), 'hsk-doc-db-'));
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
        AI_PROVIDER: 'mock',
        DEMO_MODE: 'true',
        AUTH_DEFAULT_ROLE: ROLES.USER,
        STORAGE_LOCAL_DIR: storageRoot,
        DOCUMENT_ASYNC_THRESHOLD_BYTES: '10485760',
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

  it('rejects unauthenticated analyze requests', async () => {
    const response = await request(app)
      .post('/api/v1/documents/analyze')
      .field('documentType', 'invoice')
      .attach('file', Buffer.from('Invoice 1', 'utf8'), { filename: 'invoice.txt', contentType: 'text/plain' });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe(ERROR_CODES.AUTHENTICATION_ERROR);
  });

  it('lets a manager upload a document, extract fields, and read the stored result', async () => {
    const { tokens } = await asManager('manager-docs@example.com');

    const analyzed = await request(app)
      .post('/api/v1/documents/analyze')
      .set('Authorization', `Bearer ${tokens.accessToken}`)
      .field('documentType', 'invoice')
      .field('fields', JSON.stringify(['invoiceNumber', 'vendor']))
      .attach('file', Buffer.from('Invoice 99 from Acme', 'utf8'), {
        filename: 'invoice.txt',
        contentType: 'text/plain',
      });

    expect(analyzed.status).toBe(200);
    expect(analyzed.body.success).toBe(true);
    expect(analyzed.body.data).toMatchObject({
      documentType: 'invoice',
      status: 'completed',
      requiresReview: false,
      fields: {
        invoiceNumber: 'sample invoiceNumber',
        vendor: 'sample vendor',
      },
    });
    expect(analyzed.body.data.id).toEqual(expect.any(String));

    const stored = await request(app)
      .get(`/api/v1/documents/${analyzed.body.data.id}`)
      .set('Authorization', `Bearer ${tokens.accessToken}`);

    expect(stored.status).toBe(200);
    expect(stored.body.data.fields).toEqual(analyzed.body.data.fields);
    expect(stored.body.data).not.toHaveProperty('storageKey');
  });

  it('does not let another user read someone else\'s document', async () => {
    const owner = await asManager('owner-docs@example.com');
    const other = await asManager('other-docs@example.com');

    const analyzed = await request(app)
      .post('/api/v1/documents/analyze')
      .set('Authorization', `Bearer ${owner.tokens.accessToken}`)
      .field('documentType', 'generic')
      .field('fields', JSON.stringify(['title']))
      .attach('file', Buffer.from('Title: Quarterly report', 'utf8'), {
        filename: 'note.txt',
        contentType: 'text/plain',
      });
    expect(analyzed.status).toBe(200);

    const stolen = await request(app)
      .get(`/api/v1/documents/${analyzed.body.data.id}`)
      .set('Authorization', `Bearer ${other.tokens.accessToken}`);

    expect(stolen.status).toBe(404);
    expect(stolen.body.error.code).toBe(ERROR_CODES.NOT_FOUND);
  });

  it('forbids a user without documents.analyze', async () => {
    const { tokens } = await register('plain-user@example.com');
    const response = await request(app)
      .post('/api/v1/documents/analyze')
      .set('Authorization', `Bearer ${tokens.accessToken}`)
      .field('documentType', 'generic')
      .attach('file', Buffer.from('hello', 'utf8'), { filename: 'note.txt', contentType: 'text/plain' });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe(ERROR_CODES.AUTHORIZATION_ERROR);
  });
});
