import express from 'express';
import pino from 'pino';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import type { AuthenticatedUser } from '../src/auth/types';
import { AuditService, createMemoryAuditStore } from '../src/audit';
import { API_PREFIX, ERROR_CODES } from '../src/constants';
import { AnalyticsController } from '../src/controllers/analytics.controller';
import { loadConfig } from '../src/config';
import { createAnalyticsService } from '../src/integrations/analytics';
import { createMemoryAnalyticsProvider } from '../src/integrations/analytics/providers/memory.provider';
import { errorHandler, requestIdMiddleware } from '../src/middleware';
import { PERMISSIONS } from '../src/rbac/catalog';
import { createAnalyticsRouter } from '../src/routes/analytics.routes';

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
  permissions: string[] = [PERMISSIONS.ANALYTICS_READ, PERMISSIONS.ANALYTICS_WRITE, PERMISSIONS.ANALYTICS_EXPORT],
) {
  const config = loadConfig({
    NODE_ENV: 'test',
    FEATURE_ANALYTICS: 'true',
    ANALYTICS_PROVIDER: 'memory',
    DEMO_MODE: 'true',
  });
  const analytics = createAnalyticsService({
    config,
    logger: pino({ level: 'silent' }),
    provider: createMemoryAnalyticsProvider(),
    audit: new AuditService(createMemoryAuditStore()),
  });
  const app = express();
  app.use(requestIdMiddleware);
  app.use(express.json());
  app.use(
    API_PREFIX,
    createAnalyticsRouter({
      controller: new AnalyticsController(analytics),
      authenticate: (req, _res, next) => {
        req.user = actor(permissions);
        next();
      },
    }),
  );
  app.use(errorHandler(pino({ level: 'silent' }), false));
  return { app, analytics };
}

describe('Analytics HTTP (authenticated, no database)', () => {
  it('lists KPIs and queries demo events', async () => {
    const { app } = buildApp();
    const kpis = await request(app).get('/api/v1/analytics/kpis');
    expect(kpis.status).toBe(200);
    expect(kpis.body.data.provider).toBe('memory');
    expect(kpis.body.data.kpis.some((item: { name: string }) => item.name === 'kit.demo.events')).toBe(true);

    const query = await request(app).post('/api/v1/analytics/query').send({
      kpi: 'kit.demo.events',
      kind: 'snapshot',
    });
    expect(query.status).toBe(200);
    expect(query.body.data.snapshot.samples).toBeGreaterThan(0);
    expect(query.body.meta.totalItems).toBe(1);
  });

  it('evaluates the demo dashboard and paginates a time series', async () => {
    const { app } = buildApp();
    const dashboard = await request(app).post('/api/v1/analytics/dashboards/kit.demo').send({});
    expect(dashboard.status).toBe(200);
    expect(dashboard.body.data.widgets).toHaveLength(4);

    const series = await request(app).post('/api/v1/analytics/query').send({
      kpi: 'kit.demo.events',
      kind: 'timeseries',
      granularity: 'day',
      page: 1,
      pageSize: 5,
    });
    expect(series.status).toBe(200);
    expect(series.body.data.points.length).toBeLessThanOrEqual(5);
    expect(series.body.meta.totalItems).toBeGreaterThan(0);
  });

  it('lets staff query but not ingest or export', async () => {
    const { app } = buildApp([PERMISSIONS.ANALYTICS_READ]);
    const found = await request(app).post('/api/v1/analytics/query').send({ kpi: 'kit.demo.events' });
    expect(found.status).toBe(200);
    const ingested = await request(app).post('/api/v1/analytics/facts').send({
      kpi: 'kit.demo.events',
      occurredAt: new Date().toISOString(),
      value: 1,
    });
    expect(ingested.status).toBe(403);
    const exported = await request(app).post('/api/v1/analytics/export').send({
      kpi: 'kit.demo.events',
      format: 'csv',
    });
    expect(exported.status).toBe(403);
  });

  it('ingests a fact and exports csv', async () => {
    const { app } = buildApp();
    const ingested = await request(app).post('/api/v1/analytics/facts').send({
      kpi: 'kit.demo.value',
      eventId: 'http-value-1',
      occurredAt: new Date().toISOString(),
      value: 12,
      dimensions: { status: 'open', category: 'ops' },
    });
    expect(ingested.status).toBe(201);

    const exported = await request(app).post('/api/v1/analytics/export').send({
      kpi: 'kit.demo.value',
      kind: 'snapshot',
      format: 'csv',
    });
    expect(exported.status).toBe(200);
    expect(exported.body.data.content).toContain('kpi,aggregation,from,to,value,samples');
  });

  it('rejects an empty kpi name', async () => {
    const { app } = buildApp();
    const response = await request(app).post('/api/v1/analytics/query').send({ kpi: ' ' });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
  });

  it('denies callers without analytics.read', async () => {
    const { app } = buildApp([]);
    const response = await request(app).post('/api/v1/analytics/query').send({ kpi: 'kit.demo.events' });
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe(ERROR_CODES.AUTHORIZATION_ERROR);
  });

  it('returns FEATURE_DISABLED when analytics is off', async () => {
    const config = loadConfig({ NODE_ENV: 'test', FEATURE_ANALYTICS: 'false' });
    const app = express();
    app.use(requestIdMiddleware);
    app.use(express.json());
    app.use(
      API_PREFIX,
      createAnalyticsRouter({
        controller: new AnalyticsController(
          createAnalyticsService({
            config,
            logger: pino({ level: 'silent' }),
            provider: createMemoryAnalyticsProvider(),
            seedDemo: false,
          }),
        ),
        authenticate: (req, _res, next) => {
          req.user = actor([PERMISSIONS.ANALYTICS_READ]);
          next();
        },
      }),
    );
    app.use(errorHandler(pino({ level: 'silent' }), false));
    const response = await request(app).post('/api/v1/analytics/query').send({ kpi: 'kit.demo.events' });
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe(ERROR_CODES.FEATURE_DISABLED);
  });
});
