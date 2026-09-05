import express from 'express';
import pino from 'pino';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import type { AuthenticatedUser } from '../src/auth/types';
import { AuditService, createMemoryAuditStore } from '../src/audit';
import { API_PREFIX, ERROR_CODES } from '../src/constants';
import { ProjectPlanningController } from '../src/controllers/project-planning.controller';
import { loadConfig } from '../src/config';
import { errorHandler, requestIdMiddleware } from '../src/middleware';
import { createProjectPlanningService } from '../src/project-planning';
import { PERMISSIONS } from '../src/rbac/catalog';
import { createProjectPlanningRouter } from '../src/routes/project-planning.routes';

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

function buildApp(permissions: string[] = [PERMISSIONS.PROJECTS_PLAN], enabled = true) {
  const config = loadConfig({
    NODE_ENV: 'test',
    FEATURE_PROJECT_PLANNING: enabled ? 'true' : 'false',
  });
  const planning = enabled
    ? createProjectPlanningService({
        config,
        logger: pino({ level: 'silent' }),
        audit: new AuditService(createMemoryAuditStore()),
      })
    : null;
  const app = express();
  app.use(requestIdMiddleware);
  app.use(express.json());
  const authenticate = (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = actor(permissions);
    next();
  };
  app.use(
    API_PREFIX,
    createProjectPlanningRouter({
      controller: new ProjectPlanningController(planning),
      authenticate,
      authenticateAnalyze: authenticate,
    }),
  );
  app.use(errorHandler(pino({ level: 'silent' }), false));
  return app;
}

describe('Project planning HTTP (authenticated, no database)', () => {
  it('analyzes a statement into a draft configuration without generating code', async () => {
    const app = buildApp();
    const response = await request(app)
      .post('/api/v1/project-planning/analyze')
      .send({ statement: 'Staff look up customer records by name in a logged-in web app.' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.configuration.generatedNothing).toBe(true);
    expect(response.body.data.configuration.approved).toBe(false);
    expect(response.body.data.configuration.generation.attempted).toBe(false);
    expect(response.body.data.recommendations.advisory).toBe(true);
  });

  it('validates an explicit selection and approves a closed set', async () => {
    const app = buildApp();
    const body = {
      capabilities: ['auth', 'database', 'infrastructure.postgres'],
      architectureMode: 'architecture.modular-monolith',
      deploymentMode: 'deployment.local-hybrid',
    };

    const validated = await request(app).post('/api/v1/project-planning/validate').send(body);
    expect(validated.status).toBe(200);
    expect(validated.body.data.validation.valid).toBe(true);
    expect(validated.body.data.approved).toBe(false);

    const approved = await request(app)
      .post('/api/v1/project-planning/approve')
      .send({ ...body, approved: true, resolved: { capabilities: ['deployment.kubernetes'] } });
    expect(approved.status).toBe(200);
    expect(approved.body.data.approved).toBe(true);
    expect(approved.body.data.resolved.capabilities).toEqual(
      ['auth', 'database', 'infrastructure.postgres'].sort(),
    );
    expect(approved.body.data.resolved.capabilities).not.toContain('deployment.kubernetes');
  });

  it('denies callers without projects.plan', async () => {
    const app = buildApp([]);
    const response = await request(app)
      .post('/api/v1/project-planning/validate')
      .send({ capabilities: ['auth'] });
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe(ERROR_CODES.AUTHORIZATION_ERROR);
  });

  it('rejects a missing statement on analyze', async () => {
    const app = buildApp();
    const response = await request(app).post('/api/v1/project-planning/analyze').send({});
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
  });

  it('rejects approval of an invalid selection', async () => {
    const app = buildApp();
    const response = await request(app)
      .post('/api/v1/project-planning/approve')
      .send({ capabilities: ['copilot'] });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
  });

  it('rejects requests when the feature is disabled', async () => {
    const app = buildApp([PERMISSIONS.PROJECTS_PLAN], false);
    const response = await request(app)
      .post('/api/v1/project-planning/validate')
      .send({ capabilities: ['auth', 'database', 'infrastructure.postgres'] });
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe(ERROR_CODES.FEATURE_DISABLED);
  });
});
