import express from 'express';
import pino from 'pino';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import type { AuthenticatedUser } from '../src/auth/types';
import { AuditService, createMemoryAuditStore } from '../src/audit';
import { API_PREFIX, ERROR_CODES } from '../src/constants';
import { SearchController } from '../src/controllers/search.controller';
import { loadConfig } from '../src/config';
import { createSearchService } from '../src/integrations/search';
import { createMemorySearchProvider } from '../src/integrations/search/providers/memory.provider';
import { errorHandler, requestIdMiddleware } from '../src/middleware';
import { PERMISSIONS } from '../src/rbac/catalog';
import { createSearchRouter } from '../src/routes/search.routes';

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

function buildApp(permissions: string[] = [PERMISSIONS.SEARCH_USE, PERMISSIONS.SEARCH_WRITE]) {
  const config = loadConfig({
    NODE_ENV: 'test',
    FEATURE_SEARCH: 'true',
    SEARCH_PROVIDER: 'memory',
    DEMO_MODE: 'true',
  });
  const search = createSearchService({
    config,
    logger: pino({ level: 'silent' }),
    provider: createMemorySearchProvider(),
    audit: new AuditService(createMemoryAuditStore()),
  });
  const app = express();
  app.use(requestIdMiddleware);
  app.use(express.json());
  app.use(
    API_PREFIX,
    createSearchRouter({
      controller: new SearchController(search),
      authenticate: (req, _res, next) => {
        req.user = actor(permissions);
        next();
      },
    }),
  );
  app.use(errorHandler(pino({ level: 'silent' }), false));
  return { app, search };
}

describe('Search HTTP (authenticated, no database)', () => {
  it('lists indexes and searches demo documents', async () => {
    const { app } = buildApp();
    const indexes = await request(app).get('/api/v1/search/indexes');
    expect(indexes.status).toBe(200);
    expect(indexes.body.data.provider).toBe('memory');
    expect(indexes.body.data.indexes.some((item: { name: string }) => item.name === 'kit.demo')).toBe(
      true,
    );

    const search = await request(app).post('/api/v1/search').send({
      query: 'refund',
      mode: 'keyword',
      pageSize: 10,
    });
    expect(search.status).toBe(200);
    expect(search.body.data.hits[0].documentId).toBe('refund-policy');
    expect(search.body.data.pagination.totalItems).toBeGreaterThan(0);
    expect(search.body.meta.totalItems).toBeGreaterThan(0);
  });

  it('indexes a document and finds it', async () => {
    const { app } = buildApp();
    const indexed = await request(app).post('/api/v1/search/documents').send({
      index: 'kit.demo',
      documentId: 'custom-note',
      title: 'Warehouse overtime policy',
      body: 'Overtime is approved by a manager.',
      fields: { status: 'published', category: 'hr' },
    });
    expect(indexed.status).toBe(201);

    const found = await request(app).post('/api/v1/search').send({
      query: 'overtime',
      mode: 'keyword',
    });
    expect(found.body.data.hits.some((hit: { documentId: string }) => hit.documentId === 'custom-note')).toBe(
      true,
    );
  });

  it('paginates browse results', async () => {
    const { app } = buildApp();
    const page1 = await request(app).post('/api/v1/search').send({
      query: '',
      sort: { field: 'title', order: 'asc' },
      page: 1,
      pageSize: 2,
    });
    const page2 = await request(app).post('/api/v1/search').send({
      query: '',
      sort: { field: 'title', order: 'asc' },
      page: 2,
      pageSize: 2,
    });
    expect(page1.status).toBe(200);
    expect(page1.body.data.hits).toHaveLength(2);
    expect(page1.body.meta.hasNextPage).toBe(true);
    expect(page2.body.data.hits).toHaveLength(1);
    expect(page2.body.meta.hasNextPage).toBe(false);
  });

  it('lets staff search but not index', async () => {
    const { app } = buildApp([PERMISSIONS.SEARCH_USE]);
    const found = await request(app).post('/api/v1/search').send({ query: 'refund' });
    expect(found.status).toBe(200);
    const indexed = await request(app).post('/api/v1/search/documents').send({
      index: 'kit.demo',
      title: 'Should fail',
      body: 'Staff cannot write the demo index.',
    });
    expect(indexed.status).toBe(403);
  });

  it('rejects an empty index name', async () => {
    const { app } = buildApp();
    const response = await request(app).post('/api/v1/search').send({ index: ' ' });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
  });

  it('denies callers without search.use', async () => {
    const { app } = buildApp([]);
    const response = await request(app).post('/api/v1/search').send({ query: 'refund' });
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe(ERROR_CODES.AUTHORIZATION_ERROR);
  });

  it('returns FEATURE_DISABLED when search is off', async () => {
    const config = loadConfig({ NODE_ENV: 'test', FEATURE_SEARCH: 'false' });
    const app = express();
    app.use(requestIdMiddleware);
    app.use(express.json());
    app.use(
      API_PREFIX,
      createSearchRouter({
        controller: new SearchController(
          createSearchService({
            config,
            logger: pino({ level: 'silent' }),
            provider: createMemorySearchProvider(),
            seedDemo: false,
          }),
        ),
        authenticate: (req, _res, next) => {
          req.user = actor([PERMISSIONS.SEARCH_USE]);
          next();
        },
      }),
    );
    app.use(errorHandler(pino({ level: 'silent' }), false));
    const response = await request(app).post('/api/v1/search').send({ query: 'refund' });
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe(ERROR_CODES.FEATURE_DISABLED);
  });
});
