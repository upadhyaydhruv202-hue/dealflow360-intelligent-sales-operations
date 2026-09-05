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
  resetDatabase,
} from './helpers/database';

const logger = pino({ level: 'silent' });
const VALID_PASSWORD = 'correct-horse';

describeDatabase('File storage HTTP (database)', () => {
  let database!: DatabaseClient;
  let app!: ReturnType<typeof createApp>['app'];
  let storageRoot = '';

  beforeAll(async () => {
    storageRoot = await mkdtemp(path.join(os.tmpdir(), 'hsk-files-db-'));
    database = createDatabaseClient({
      url: process.env.DATABASE_URL as string,
      poolMax: 5,
      poolTimeoutSeconds: 10,
    });
    app = createApp({
      config: loadConfig({
        ...AUTH_TEST_ENV,
        DATABASE_URL: process.env.DATABASE_URL,
        AUTH_DEFAULT_ROLE: ROLES.USER,
        STORAGE_PROVIDER: 'local',
        STORAGE_LOCAL_DIR: storageRoot,
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

  it('persists upload metadata and serves a signed download', async () => {
    const session = await register('files-owner@example.com');
    const uploaded = await request(app)
      .post('/api/v1/files')
      .set('Authorization', `Bearer ${session.tokens.accessToken}`)
      .field('purpose', 'attachment')
      .attach('file', Buffer.from('stored in postgres metadata'), 'notes.txt');

    expect(uploaded.status).toBe(201);
    expect(uploaded.body.data.uploadedBy).toBe(session.user.id);
    expect(uploaded.body.data.provider).toBe('local');

    const prisma = getTestPrisma();
    const row = await prisma.storedFile.findUnique({ where: { id: uploaded.body.data.id } });
    expect(row?.originalName).toBe('notes.txt');
    expect(row?.storageKey).toContain('files/attachments/');

    expect(uploaded.body.data.download.url).toContain(`uid=${session.user.id}`);
    const downloaded = await request(app)
      .get(
        new URL(uploaded.body.data.download.url).pathname + new URL(uploaded.body.data.download.url).search,
      )
      .set('Authorization', `Bearer ${session.tokens.accessToken}`);
    expect(downloaded.status).toBe(200);
    expect(downloaded.text).toBe('stored in postgres metadata');
  });

  it('does not let another user delete a private file', async () => {
    const owner = await register('files-owner-2@example.com');
    const other = await register('files-other@example.com');
    const uploaded = await request(app)
      .post('/api/v1/files')
      .set('Authorization', `Bearer ${owner.tokens.accessToken}`)
      .attach('file', Buffer.from('private'), 'notes.txt');

    const denied = await request(app)
      .delete(`/api/v1/files/${uploaded.body.data.id}`)
      .set('Authorization', `Bearer ${other.tokens.accessToken}`);
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe(ERROR_CODES.AUTHORIZATION_ERROR);
  });
});
