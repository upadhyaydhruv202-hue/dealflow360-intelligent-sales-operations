import express from 'express';
import pino from 'pino';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import type { AuthenticatedUser } from '../src/auth/types';
import { AuditService, createMemoryAuditStore } from '../src/audit';
import { API_PREFIX, ERROR_CODES } from '../src/constants';
import { CapabilityRecommendationController } from '../src/controllers/capability-recommendations.controller';
import { loadConfig } from '../src/config';
import { errorHandler, requestIdMiddleware } from '../src/middleware';
import {
  analysisSimpleSearch,
  createCapabilityRecommendationService,
} from '../src/capability-recommendations';
import { PERMISSIONS } from '../src/rbac/catalog';
import { createCapabilityRecommendationRouter } from '../src/routes/capability-recommendations.routes';

function actor(permissions: string[]): AuthenticatedUser {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'manager@example.com',
    displayName: 'Manager',
    status: 'active',
    role: 'manager',
    roles: ['manager'],
    permissions,
  };
}

function buildApp(
  permissions: string[] = [PERMISSIONS.CAPABILITIES_RECOMMEND],
  enabled = true,
) {
  const config = loadConfig({
    NODE_ENV: 'test',
    FEATURE_CAPABILITY_RECOMMENDATIONS: enabled ? 'true' : 'false',
  });
  const recommendations = enabled
    ? createCapabilityRecommendationService({
        config,
        logger: pino({ level: 'silent' }),
        audit: new AuditService(createMemoryAuditStore()),
      })
    : null;
  const app = express();
  app.use(requestIdMiddleware);
  app.use(express.json());
  app.use(
    API_PREFIX,
    createCapabilityRecommendationRouter({
      controller: new CapabilityRecommendationController(recommendations),
      authenticate: (req, _res, next) => {
        req.user = actor(permissions);
        next();
      },
    }),
  );
  app.use(errorHandler(pino({ level: 'silent' }), false));
  return app;
}

describe('Capability recommendations HTTP (authenticated, no database)', () => {
  it('returns deterministic advisory recommendations for simple search', async () => {
    const app = buildApp();
    const response = await request(app)
      .post('/api/v1/capability-recommendations/recommend')
      .send({ analysis: analysisSimpleSearch(), title: 'Simple search' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.advisory).toBe(true);
    expect(response.body.data.humanSelectionAuthoritative).toBe(true);
    expect(response.body.data.enabledNothing).toBe(true);
    expect(response.body.data.selected.infrastructure).toContain('infrastructure.postgres');
    expect(response.body.data.selected.capabilities).toContain('search');
    expect(response.body.data.selected.capabilities).not.toContain('rag');
    expect(response.body.data.rejected.some((item: { capabilitySelected: string }) => item.capabilitySelected === 'elasticsearch')).toBe(
      true,
    );
  });

  it('denies callers without capabilities.recommend', async () => {
    const app = buildApp([]);
    const response = await request(app)
      .post('/api/v1/capability-recommendations/recommend')
      .send({ analysis: analysisSimpleSearch() });
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe(ERROR_CODES.AUTHORIZATION_ERROR);
  });

  it('rejects a missing analysis body', async () => {
    const app = buildApp();
    const response = await request(app).post('/api/v1/capability-recommendations/recommend').send({});
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
  });

  it('rejects requests when the feature is disabled', async () => {
    const app = buildApp([PERMISSIONS.CAPABILITIES_RECOMMEND], false);
    const response = await request(app)
      .post('/api/v1/capability-recommendations/recommend')
      .send({ analysis: analysisSimpleSearch() });
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe(ERROR_CODES.FEATURE_DISABLED);
  });
});
