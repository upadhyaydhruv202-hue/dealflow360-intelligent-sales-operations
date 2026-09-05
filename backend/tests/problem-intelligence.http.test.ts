import express from 'express';
import pino from 'pino';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import type { AuthenticatedUser } from '../src/auth/types';
import { AuditService, createMemoryAuditStore } from '../src/audit';
import { createPlatformCapabilityRegistry } from '../src/capabilities';
import { API_PREFIX, ERROR_CODES } from '../src/constants';
import { ProblemIntelligenceController } from '../src/controllers/problem-intelligence.controller';
import { loadConfig } from '../src/config';
import { createTestService } from '../src/integrations/ai/ai.test-helpers';
import { errorHandler, requestIdMiddleware } from '../src/middleware';
import { buildProblemIntelligenceDraft, createProblemIntelligenceService } from '../src/problem-intelligence';
import { PERMISSIONS } from '../src/rbac/catalog';
import { createProblemIntelligenceRouter } from '../src/routes/problem-intelligence.routes';

const STATEMENT = 'Staff must log in and create a work item. A manager reviews it on a dashboard.';

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

function buildApp(permissions: string[] = [PERMISSIONS.PROBLEM_ANALYZE]) {
  const config = loadConfig({
    NODE_ENV: 'test',
    FEATURE_PROBLEM_INTELLIGENCE: 'true',
    FEATURE_AI: 'true',
    AI_PROVIDER: 'mock',
    DEMO_MODE: 'true',
  });
  const { service: ai, provider } = createTestService({ runtime: { parseRetries: 0 } });
  const intelligence = createProblemIntelligenceService({
    config,
    logger: pino({ level: 'silent' }),
    ai,
    capabilities: createPlatformCapabilityRegistry(),
    audit: new AuditService(createMemoryAuditStore()),
  });
  const app = express();
  app.use(requestIdMiddleware);
  app.use(express.json());
  app.use(
    API_PREFIX,
    createProblemIntelligenceRouter({
      controller: new ProblemIntelligenceController(intelligence),
      authenticate: (req, _res, next) => {
        req.user = actor(permissions);
        next();
      },
    }),
  );
  app.use(errorHandler(pino({ level: 'silent' }), false));
  return { app, provider };
}

describe('Problem intelligence HTTP (authenticated, no database)', () => {
  it('analyzes a problem statement into classified requirements', async () => {
    const { app, provider } = buildApp();
    provider.enqueue(JSON.stringify(buildProblemIntelligenceDraft()));

    const response = await request(app)
      .post('/api/v1/problem-intelligence/analyze')
      .send({ statement: STATEMENT, title: 'Work items' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.spec.problemSummary).toContain('Staff log in');
    expect(response.body.data.spec.users.determined).toBe(true);
    expect(response.body.data.spec.odooRequirements).toEqual({ determined: false, items: [] });
    expect(response.body.data.mappings[0].existingCapability.name).toBe('auth');
    expect(response.body.data.existingCapabilities.some((item: { name: string }) => item.name === 'auth')).toBe(
      true,
    );
    expect(response.body.data).not.toHaveProperty('executeSql');
  });

  it('denies callers without problem.analyze', async () => {
    const { app } = buildApp([]);
    const response = await request(app)
      .post('/api/v1/problem-intelligence/analyze')
      .send({ statement: STATEMENT });
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe(ERROR_CODES.AUTHORIZATION_ERROR);
  });

  it('rejects an empty statement', async () => {
    const { app } = buildApp();
    const response = await request(app).post('/api/v1/problem-intelligence/analyze').send({ statement: '' });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
  });

  it('rejects malformed AI output', async () => {
    const { app, provider } = buildApp();
    provider.enqueue('<<<not-json>>>');
    const response = await request(app)
      .post('/api/v1/problem-intelligence/analyze')
      .send({ statement: STATEMENT });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
  });
});
