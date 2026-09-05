import express from 'express';
import pino from 'pino';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import type { AuthenticatedUser } from '../src/auth/types';
import { AnomalyController } from '../src/controllers/anomaly.controller';
import { AuditService, createMemoryAuditStore } from '../src/audit';
import { createAnomalyService } from '../src/anomaly';
import { HIGH_DROP_SALES, STABLE_SALES } from '../src/anomaly/fixtures';
import { createMemoryAnomalyStore } from '../src/anomaly/stores/memory.store';
import { API_PREFIX, ERROR_CODES } from '../src/constants';
import { loadConfig } from '../src/config';
import { createTestService, silentLogger } from '../src/integrations/ai/ai.test-helpers';
import { errorHandler, requestIdMiddleware } from '../src/middleware';
import { PERMISSIONS } from '../src/rbac/catalog';
import { createAnomalyRouter } from '../src/routes/anomaly.routes';

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
  permissions: string[] = [PERMISSIONS.ANOMALY_USE],
  env: Record<string, string> = {},
  extras: { store?: ReturnType<typeof createMemoryAnomalyStore>; userId?: string } = {},
) {
  const config = loadConfig({
    NODE_ENV: 'test',
    FEATURE_ANOMALY_DETECTION: 'true',
    FEATURE_AI: 'true',
    AI_PROVIDER: 'mock',
    DEMO_MODE: 'true',
    ...env,
  });
  const { service: ai } = createTestService();
  const anomaly = createAnomalyService({
    config,
    logger: silentLogger,
    ai,
    store: extras.store ?? createMemoryAnomalyStore(),
    audit: new AuditService(createMemoryAuditStore()),
  });
  const app = express();
  app.use(requestIdMiddleware);
  app.use(express.json());
  app.use(
    API_PREFIX,
    createAnomalyRouter({
      controller: new AnomalyController(anomaly),
      authenticate: (req, _res, next) => {
        req.user = actor(permissions, extras.userId);
        next();
      },
    }),
  );
  app.use(errorHandler(pino({ level: 'silent' }), false));
  return { app, anomaly };
}

describe('Anomaly HTTP (authenticated, no database)', () => {
  it('evaluates a series and returns measured fields separate from explanation', async () => {
    const { app } = buildApp();
    const response = await request(app).post('/api/v1/anomalies/evaluate').send({
      metric: 'sales',
      points: HIGH_DROP_SALES,
    });
    expect(response.status).toBe(200);
    expect(response.body.data.metric).toBe('sales');
    expect(response.body.data.anomaly).toBe(true);
    expect(response.body.data.severity).toBe('HIGH');
    expect(response.body.data.change).toBe(-23.4);
    expect(response.body.data.evidence.claimsStatisticalSignificance).toBe(false);
    expect(response.body.data.explanation).toEqual(expect.any(String));
    expect(response.body.data.recommendedAction).toEqual(expect.any(String));
  });

  it('returns no anomaly for a stable series', async () => {
    const { app } = buildApp();
    const response = await request(app).post('/api/v1/anomalies/evaluate').send({
      metric: 'sales',
      points: STABLE_SALES,
      explain: false,
    });
    expect(response.status).toBe(200);
    expect(response.body.data.anomaly).toBe(false);
    expect(response.body.data.severity).toBe('NONE');
  });

  it('lists persisted findings', async () => {
    const { app } = buildApp();
    const created = await request(app).post('/api/v1/anomalies/evaluate').send({
      metric: 'sales',
      points: HIGH_DROP_SALES,
      explain: false,
    });
    const listed = await request(app).get('/api/v1/anomalies');
    expect(listed.status).toBe(200);
    expect(listed.body.data.items[0].id).toBe(created.body.data.id);

    const fetched = await request(app).get(`/api/v1/anomalies/${created.body.data.id}`);
    expect(fetched.status).toBe(200);
    expect(fetched.body.data.metric).toBe('sales');
  });

  it('returns FEATURE_DISABLED when the controller has no service', async () => {
    const app = express();
    app.use(requestIdMiddleware);
    app.use(express.json());
    app.use(
      API_PREFIX,
      createAnomalyRouter({
        controller: new AnomalyController(null),
        authenticate: (req, _res, next) => {
          req.user = actor([PERMISSIONS.ANOMALY_USE]);
          next();
        },
      }),
    );
    app.use(errorHandler(pino({ level: 'silent' }), false));

    const response = await request(app).post('/api/v1/anomalies/evaluate').send({
      metric: 'sales',
      points: STABLE_SALES,
    });
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe(ERROR_CODES.FEATURE_DISABLED);
  });

  it('denies callers without anomaly.use', async () => {
    const { app } = buildApp([]);
    const response = await request(app).post('/api/v1/anomalies/evaluate').send({
      metric: 'sales',
      points: STABLE_SALES,
    });
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe(ERROR_CODES.AUTHORIZATION_ERROR);
  });

  it('rejects invalid input', async () => {
    const { app } = buildApp();
    const response = await request(app).post('/api/v1/anomalies/evaluate').send({
      metric: 'sales',
      points: [],
    });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
  });

  it('scopes findings to the evaluating user', async () => {
    const store = createMemoryAnomalyStore();
    const owner = buildApp([PERMISSIONS.ANOMALY_USE], {}, { store });
    const other = buildApp(
      [PERMISSIONS.ANOMALY_USE],
      {},
      { store, userId: '22222222-2222-2222-2222-222222222222' },
    );

    const created = await request(owner.app).post('/api/v1/anomalies/evaluate').send({
      metric: 'sales',
      points: HIGH_DROP_SALES,
      explain: false,
    });
    expect(created.status).toBe(200);
    const id = created.body.data.id as string;

    const listed = await request(other.app).get('/api/v1/anomalies');
    expect(listed.status).toBe(200);
    expect(listed.body.data.items).toEqual([]);

    const fetched = await request(other.app).get(`/api/v1/anomalies/${id}`);
    expect(fetched.status).toBe(404);
  });
});
