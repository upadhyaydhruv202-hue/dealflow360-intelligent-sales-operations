import express from 'express';
import pino from 'pino';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import type { AuthenticatedUser } from '../src/auth/types';
import { AuditService, createMemoryAuditStore } from '../src/audit';
import { API_PREFIX, ERROR_CODES } from '../src/constants';
import { RagController } from '../src/controllers/rag.controller';
import { loadConfig } from '../src/config';
import { createTestService, silentLogger } from '../src/integrations/ai/ai.test-helpers';
import { createRagService } from '../src/integrations/rag';
import { createMemoryVectorStore } from '../src/integrations/rag/stores/memory.store';
import { LexicalEmbeddingProvider } from '../src/integrations/rag/embeddings/lexical.provider';
import { errorHandler, requestIdMiddleware } from '../src/middleware';
import { PERMISSIONS } from '../src/rbac/catalog';
import { createRagRouter } from '../src/routes/rag.routes';

function actor(permissions: string[], id = '11111111-1111-1111-1111-111111111111'): AuthenticatedUser {
  return {
    id,
    email: 'manager@example.com',
    displayName: 'Manager',
    status: 'active',
    role: 'manager',
    roles: ['manager'],
    permissions,
  };
}

function buildApp(
  permissions: string[] = [PERMISSIONS.RAG_USE],
  env: Record<string, string> = {},
  extras: { store?: ReturnType<typeof createMemoryVectorStore>; userId?: string } = {},
) {
  const config = loadConfig({
    NODE_ENV: 'test',
    FEATURE_RAG: 'true',
    FEATURE_AI: 'true',
    AI_PROVIDER: 'mock',
    DEMO_MODE: 'true',
    RAG_MIN_SCORE: '0.15',
    ...env,
  });
  const { service: ai } = createTestService();
  const rag = createRagService({
    config,
    logger: silentLogger,
    ai,
    store: extras.store ?? createMemoryVectorStore(),
    embeddings: new LexicalEmbeddingProvider(),
    audit: new AuditService(createMemoryAuditStore()),
  });
  const app = express();
  app.use(requestIdMiddleware);
  app.use(express.json());
  app.use(
    API_PREFIX,
    createRagRouter({
      controller: new RagController(rag),
      authenticate: (req, _res, next) => {
        req.user = actor(permissions, extras.userId);
        next();
      },
    }),
  );
  app.use(errorHandler(pino({ level: 'silent' }), false));
  return { app, rag };
}

describe('RAG HTTP (authenticated, no database)', () => {
  it('indexes, searches, and answers with sources', async () => {
    const { app } = buildApp();
    const indexed = await request(app).post('/api/v1/rag/index').send({
      documentId: 'refund-policy',
      source: 'Refund policy',
      text: 'Customers may request a refund within 14 days when a shipment arrives late.',
    });
    expect(indexed.status).toBe(201);
    expect(indexed.body.data.documentId).toBe('refund-policy');

    const search = await request(app).post('/api/v1/rag/search').send({
      query: 'When can I request a refund for a late shipment?',
    });
    expect(search.status).toBe(200);
    expect(search.body.data.chunks[0].documentId).toBe('refund-policy');

    const asked = await request(app).post('/api/v1/rag/ask').send({
      query: 'What is the refund window for a late shipment?',
    });
    expect(asked.status).toBe(200);
    expect(asked.body.data.grounded).toBe(true);
    expect(asked.body.data.sources[0].documentId).toBe('refund-policy');
  });

  it('returns FEATURE_DISABLED when the controller has no service', async () => {
    const app = express();
    app.use(requestIdMiddleware);
    app.use(express.json());
    app.use(
      API_PREFIX,
      createRagRouter({
        controller: new RagController(null),
        authenticate: (req, _res, next) => {
          req.user = actor([PERMISSIONS.RAG_USE]);
          next();
        },
      }),
    );
    app.use(errorHandler(pino({ level: 'silent' }), false));

    const response = await request(app).post('/api/v1/rag/search').send({ query: 'hello' });
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe(ERROR_CODES.FEATURE_DISABLED);
  });

  it('denies callers without rag.use', async () => {
    const { app } = buildApp([]);
    const response = await request(app).post('/api/v1/rag/search').send({ query: 'refund' });
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe(ERROR_CODES.AUTHORIZATION_ERROR);
  });

  it('returns NOT_FOUND for a missing document', async () => {
    const { app } = buildApp();
    const response = await request(app).get('/api/v1/rag/documents/missing-doc');
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe(ERROR_CODES.NOT_FOUND);
  });

  it('rejects an empty search query', async () => {
    const { app } = buildApp();
    const response = await request(app).post('/api/v1/rag/search').send({ query: '   ' });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
  });

  it('scopes documents to the indexing user', async () => {
    const store = createMemoryVectorStore();
    const owner = buildApp([PERMISSIONS.RAG_USE], {}, { store });
    const other = buildApp(
      [PERMISSIONS.RAG_USE],
      {},
      { store, userId: '22222222-2222-2222-2222-222222222222' },
    );

    const indexed = await request(owner.app).post('/api/v1/rag/index').send({
      documentId: 'owner-only',
      source: 'Internal memo',
      text: 'The confidential refund window is fourteen days.',
    });
    expect(indexed.status).toBe(201);

    const hidden = await request(other.app).get('/api/v1/rag/documents/owner-only');
    expect(hidden.status).toBe(404);

    const search = await request(other.app).post('/api/v1/rag/search').send({
      query: 'confidential refund window',
    });
    expect(search.status).toBe(200);
    expect(search.body.data.chunks).toEqual([]);
  });
});
