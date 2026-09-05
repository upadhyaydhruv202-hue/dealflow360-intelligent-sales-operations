import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import express from 'express';
import pino from 'pino';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';

import type { AuthenticatedUser } from '../src/auth/types';
import { API_PREFIX, ERROR_CODES } from '../src/constants';
import { StorageController } from '../src/controllers/storage.controller';
import { LocalStorageProvider } from '../src/integrations/storage/providers/local.provider';
import { MemoryFileStore } from '../src/integrations/storage/storage.memory';
import { StorageService } from '../src/integrations/storage/storage.service';
import { errorHandler, requestIdMiddleware } from '../src/middleware';
import { PERMISSIONS } from '../src/rbac/catalog';
import { createStorageRouter } from '../src/routes/storage.routes';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_ID = '22222222-2222-4222-8222-222222222222';
const SIGNING_SECRET = 'storage-http-test-secret';

function actor(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: USER_ID,
    email: 'user@example.com',
    displayName: 'User',
    status: 'active',
    role: 'user',
    roles: ['user'],
    permissions: [PERMISSIONS.FILES_READ, PERMISSIONS.FILES_WRITE],
    ...overrides,
  };
}

describe('Storage file HTTP', () => {
  let root = '';

  afterEach(async () => {
    if (root) {
      await rm(root, { recursive: true, force: true });
    }
  });

  async function buildApp(user: AuthenticatedUser = actor(), maxBytes = 1024) {
    root = await mkdtemp(path.join(os.tmpdir(), 'hsk-files-http-'));
    const storage = new StorageService(new LocalStorageProvider(root), {
      signing: { appUrl: 'http://localhost:5000', secret: SIGNING_SECRET },
      files: new MemoryFileStore(),
      maxBytes,
      configuredProvider: 'local',
      signedUrlExpiresSeconds: 300,
    });
    const app = express();
    app.use(requestIdMiddleware);
    app.use(express.json());
    app.use(
      API_PREFIX,
      createStorageRouter({
        controller: new StorageController(storage, SIGNING_SECRET),
        authenticate: (req, _res, next) => {
          req.user = user;
          next();
        },
        authenticateOptional: (req, _res, next) => {
          const actorId = req.header('x-test-actor');
          if (!actorId) {
            next();
            return;
          }
          req.user = actor({
            id: actorId,
            email: `${actorId}@example.com`,
            permissions:
              actorId === USER_ID
                ? [PERMISSIONS.FILES_READ, PERMISSIONS.FILES_WRITE]
                : actorId === 'admin'
                  ? [PERMISSIONS.ADMIN_SETTINGS]
                  : [PERMISSIONS.FILES_READ],
          });
          next();
        },
        maxBytes,
      }),
    );
    app.use(errorHandler(pino({ level: 'silent' }), false));
    return { app, storage };
  }

  it('uploads a file, returns a signed URL, and downloads the bytes', async () => {
    const { app } = await buildApp();
    const uploaded = await request(app)
      .post('/api/v1/files')
      .attach('file', Buffer.from('hello file'), 'notes.txt');

    expect(uploaded.status).toBe(201);
    expect(uploaded.body.success).toBe(true);
    expect(uploaded.body.data.originalName).toBe('notes.txt');
    expect(uploaded.body.data.mimeType).toBe('text/plain');
    expect(uploaded.body.data).not.toHaveProperty('key');
    expect(uploaded.body.data).not.toHaveProperty('storageKey');
    expect(uploaded.body.data.download.url).toContain('/api/v1/storage/download');
    expect(uploaded.body.data.download.url).toContain(`uid=${USER_ID}`);

    const content = await request(app).get(`/api/v1/files/${uploaded.body.data.id}/content`);
    expect(content.status).toBe(200);
    expect(content.text).toBe('hello file');

    const downloadPath =
      new URL(uploaded.body.data.download.url).pathname + new URL(uploaded.body.data.download.url).search;
    const anonymous = await request(app).get(downloadPath);
    expect(anonymous.status).toBe(401);

    const other = await request(app).get(downloadPath).set('x-test-actor', OTHER_ID);
    expect(other.status).toBe(403);

    const signed = await request(app).get(downloadPath).set('x-test-actor', USER_ID);
    expect(signed.status).toBe(200);
    expect(signed.text).toBe('hello file');
  });

  it('rejects invalid and oversized uploads', async () => {
    const { app } = await buildApp(actor(), 32);
    const invalid = await request(app)
      .post('/api/v1/files')
      .attach('file', Buffer.from('MZ'), 'payload.exe');
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);

    const oversized = await request(app)
      .post('/api/v1/files')
      .attach('file', Buffer.alloc(64, 65), 'big.txt');
    expect(oversized.status).toBe(400);
    expect(oversized.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
  });

  it('deletes a file and then returns not found', async () => {
    const { app } = await buildApp();
    const uploaded = await request(app)
      .post('/api/v1/files')
      .attach('file', Buffer.from('temp'), 'notes.txt');
    const id = uploaded.body.data.id as string;

    const deleted = await request(app).delete(`/api/v1/files/${id}`);
    expect(deleted.status).toBe(200);
    expect(deleted.body.data.deleted).toBe(true);

    const missing = await request(app).get(`/api/v1/files/${id}`);
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe(ERROR_CODES.NOT_FOUND);
  });

  it('returns not found for a missing file id', async () => {
    const { app } = await buildApp();
    const missing = await request(app).get('/api/v1/files/11111111-1111-4111-8111-111111111111');
    expect(missing.status).toBe(404);
  });

  it('issues a signed URL with a requested expiry', async () => {
    const { app } = await buildApp();
    const uploaded = await request(app)
      .post('/api/v1/files')
      .attach('file', Buffer.from('signed'), 'notes.txt');
    const signed = await request(app)
      .post(`/api/v1/files/${uploaded.body.data.id}/url`)
      .send({ expiresInSeconds: 60 });
    expect(signed.status).toBe(200);
    expect(signed.body.data.url).toContain('expires=');
    expect(signed.body.data.url).toContain(`uid=${USER_ID}`);
    expect(signed.body.data).not.toHaveProperty('key');
  });

  it('forbids another user from reading a private file', async () => {
    const { app, storage } = await buildApp();
    const uploaded = await storage.upload({
      originalname: 'notes.txt',
      size: 4,
      buffer: Buffer.from('priv'),
      uploadedBy: OTHER_ID,
    });
    const response = await request(app).get(`/api/v1/files/${uploaded.id}`);
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe(ERROR_CODES.AUTHORIZATION_ERROR);
  });

  it('allows possession-based download when the signature has no uid', async () => {
    const { app, storage } = await buildApp();
    const object = await storage.put({
      key: 'pdfs/report.pdf',
      body: Buffer.from('%PDF-1.4 test'),
      contentType: 'application/pdf',
    });
    const link = await storage.signDownload(object.key);
    expect(link.url).not.toContain('uid=');
    const download = await request(app).get(new URL(link.url).pathname + new URL(link.url).search);
    expect(download.status).toBe(200);
    expect(download.body).toEqual(Buffer.from('%PDF-1.4 test'));
  });
});
