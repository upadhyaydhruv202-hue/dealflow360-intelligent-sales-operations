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

describeDatabase('Notifications, PDF, and signed downloads (database)', () => {
  let database!: DatabaseClient;
  let app!: ReturnType<typeof createApp>['app'];
  let storageRoot = '';

  beforeAll(async () => {
    storageRoot = await mkdtemp(path.join(os.tmpdir(), 'hsk-notify-pdf-'));
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
        STORAGE_LOCAL_DIR: storageRoot,
        DEMO_MODE: 'true',
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

  function authHeader(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  it('lets a user list notifications and a manager create one for them', async () => {
    const user = await register('notify-user@example.com');
    const manager = await asManager('notify-manager@example.com');

    const empty = await request(app)
      .get('/api/v1/notifications')
      .set(authHeader(user.tokens.accessToken));
    expect(empty.status).toBe(200);
    expect(empty.body.data.items).toEqual([]);

    const forbidden = await request(app)
      .post('/api/v1/notifications')
      .set(authHeader(user.tokens.accessToken))
      .send({ userId: user.user.id, title: 'Nope', body: 'Forbidden' });
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe(ERROR_CODES.AUTHORIZATION_ERROR);

    const created = await request(app)
      .post('/api/v1/notifications')
      .set(authHeader(manager.tokens.accessToken))
      .send({
        userId: user.user.id,
        type: 'info',
        title: 'Welcome',
        body: 'Your demo account is ready',
      });
    expect(created.status).toBe(201);
    expect(created.body.data.title).toBe('Welcome');

    const unread = await request(app)
      .get('/api/v1/notifications/unread-count')
      .set(authHeader(user.tokens.accessToken));
    expect(unread.status).toBe(200);
    expect(unread.body.data.count).toBe(1);

    const listed = await request(app)
      .get('/api/v1/notifications')
      .set(authHeader(user.tokens.accessToken));
    expect(listed.body.data.items).toHaveLength(1);

    const read = await request(app)
      .post(`/api/v1/notifications/${created.body.data.id}/read`)
      .set(authHeader(user.tokens.accessToken));
    expect(read.status).toBe(200);
    expect(read.body.data.readAt).toBeTruthy();
  });

  it('lets a manager generate a PDF and download it with a signed URL', async () => {
    const user = await register('pdf-user@example.com');
    const manager = await asManager('pdf-manager@example.com');

    const denied = await request(app)
      .post('/api/v1/pdf/generate')
      .set(authHeader(user.tokens.accessToken))
      .send({ title: 'Denied', sections: [{ lines: ['Nope'] }] });
    expect(denied.status).toBe(403);

    const generated = await request(app)
      .post('/api/v1/pdf/generate')
      .set(authHeader(manager.tokens.accessToken))
      .send({
        title: 'Weekly summary',
        sections: [{ heading: 'Notes', lines: ['All clear'] }],
      });
    expect(generated.status).toBe(200);
    expect(generated.body.data.contentType).toBe('application/pdf');
    expect(generated.body.data.download.url).toContain('/api/v1/storage/download');

    const downloadUrl = new URL(generated.body.data.download.url);
    const downloaded = await request(app)
      .get(`${downloadUrl.pathname}${downloadUrl.search}`)
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      });
    expect(downloaded.status).toBe(200);
    expect(downloaded.headers['content-type']).toMatch(/pdf/);
    expect(Buffer.from(downloaded.body).subarray(0, 4).toString()).toBe('%PDF');

    const tampered = await request(app).get(
      `${downloadUrl.pathname}?key=${downloadUrl.searchParams.get('key')}&expires=${downloadUrl.searchParams.get('expires')}&sig=${'a'.repeat(64)}`,
    );
    expect(tampered.status).toBe(401);
    expect(tampered.body.error.code).toBe(ERROR_CODES.AUTHENTICATION_ERROR);
  });
});
