import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import express from 'express';
import pino from 'pino';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';

import type { AuthenticatedUser } from '../src/auth/types';
import { loadConfig } from '../src/config';
import { API_PREFIX, ERROR_CODES } from '../src/constants';
import { DocumentController } from '../src/controllers/document.controller';
import { createAiService } from '../src/integrations/ai';
import { createDocumentIntelligenceService } from '../src/integrations/documents';
import { LocalStorageProvider } from '../src/integrations/storage/providers/local.provider';
import { StorageService } from '../src/integrations/storage/storage.service';
import { createJobQueue } from '../src/jobs';
import { errorHandler, requestIdMiddleware } from '../src/middleware';
import { PERMISSIONS } from '../src/rbac/catalog';
import { createDocumentRouter } from '../src/routes/document.routes';
import { MockAiProvider } from '../src/integrations/ai/providers/mock.provider';
import { MemoryDocumentRepository } from './helpers/memory-documents';

const USER_ID = '11111111-1111-4111-8111-111111111111';

function actor(permissions: string[]): AuthenticatedUser {
  return {
    id: USER_ID,
    email: 'manager@example.com',
    displayName: 'Manager',
    status: 'active',
    role: 'manager',
    roles: ['manager'],
    permissions,
  };
}

describe('Document HTTP (authenticated, no database)', () => {
  let root = '';

  afterEach(async () => {
    if (root) {
      await rm(root, { recursive: true, force: true });
    }
  });

  async function buildApp(
    permissions: string[] = [PERMISSIONS.DOCUMENTS_ANALYZE, PERMISSIONS.DOCUMENTS_READ],
    options: { maxBytes?: number; provider?: MockAiProvider } = {},
  ) {
    root = await mkdtemp(path.join(os.tmpdir(), 'hsk-doc-http-'));
    const config = loadConfig({
      NODE_ENV: 'test',
      AI_ENABLED: 'true',
      AI_PROVIDER: 'mock',
      DEMO_MODE: 'true',
      DOCUMENT_MAX_BYTES: String(options.maxBytes ?? 10 * 1024 * 1024),
      DOCUMENT_ASYNC_THRESHOLD_BYTES: '10485760',
      STORAGE_LOCAL_DIR: root,
    });
    const provider = options.provider ?? new MockAiProvider();
    const service = createDocumentIntelligenceService({
      config,
      logger: pino({ level: 'silent' }),
      documents: new MemoryDocumentRepository(),
      storage: new StorageService(new LocalStorageProvider(root)),
      ai: createAiService({ config, logger: pino({ level: 'silent' }), provider }),
      jobs: createJobQueue(),
    });
    const app = express();
    app.use(requestIdMiddleware);
    app.use(
      API_PREFIX,
      createDocumentRouter({
        controller: new DocumentController(service),
        authenticate: (req, _res, next) => {
          req.user = actor(permissions);
          next();
        },
        maxBytes: options.maxBytes ?? config.documents.maxBytes,
      }),
    );
    app.use(errorHandler(pino({ level: 'silent' }), false));
    return { app, provider, service };
  }

  it('analyzes a valid text upload', async () => {
    const provider = new MockAiProvider();
    provider.enqueue(
      JSON.stringify({
        fields: { invoiceNumber: '99', total: '12.00' },
        missingFields: [],
        confidence: 0.91,
        warnings: [],
        requiresReview: false,
      }),
    );
    const { app } = await buildApp(undefined, { provider });

    const response = await request(app)
      .post('/api/v1/documents/analyze')
      .field('documentType', 'invoice')
      .field('fields', JSON.stringify(['invoiceNumber', 'total']))
      .attach('file', Buffer.from('Invoice 99 total 12.00', 'utf8'), {
        filename: 'invoice.txt',
        contentType: 'text/plain',
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      documentType: 'invoice',
      fields: { invoiceNumber: '99', total: '12.00' },
      confidence: 0.91,
      requiresReview: false,
    });
  });

  it('rejects an unsupported file type', async () => {
    const { app } = await buildApp();
    const response = await request(app)
      .post('/api/v1/documents/analyze')
      .field('documentType', 'generic')
      .attach('file', Buffer.from('GIF89a'), { filename: 'x.gif', contentType: 'image/gif' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
  });

  it('rejects an oversized file', async () => {
    const { app } = await buildApp(undefined, { maxBytes: 32 });
    const response = await request(app)
      .post('/api/v1/documents/analyze')
      .field('documentType', 'generic')
      .attach('file', Buffer.alloc(64, 65), { filename: 'big.txt', contentType: 'text/plain' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
  });

  it('forbids callers without documents.analyze', async () => {
    const { app } = await buildApp([]);
    const response = await request(app)
      .post('/api/v1/documents/analyze')
      .field('documentType', 'generic')
      .attach('file', Buffer.from('hello', 'utf8'), { filename: 'note.txt', contentType: 'text/plain' });

    expect(response.status).toBe(403);
  });
});
