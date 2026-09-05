import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import express from 'express';
import pino from 'pino';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';

import type { AuthenticatedUser } from '../src/auth/types';
import { AuditService, createMemoryAuditStore } from '../src/audit';
import { API_PREFIX, ERROR_CODES } from '../src/constants';
import { ProjectGeneratorController } from '../src/controllers/project-generator.controller';
import { loadConfig } from '../src/config';
import { errorHandler, requestIdMiddleware } from '../src/middleware';
import { buildProjectConfiguration } from '../src/project-planning';
import { createProjectGeneratorService } from '../src/project-generator';
import { PERMISSIONS } from '../src/rbac/catalog';
import { createProjectGeneratorRouter } from '../src/routes/project-generator.routes';

const AUTH_STACK = ['auth', 'database', 'infrastructure.postgres'] as const;
const temps: string[] = [];

afterEach(async () => {
  await Promise.all(temps.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

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

async function kitRoot(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'hsk-gen-http-'));
  temps.push(dir);
  await writeFile(
    path.join(dir, 'package.json'),
    JSON.stringify({ name: 'hackathon-starter-kit', workspaces: ['backend'] }),
    'utf8',
  );
  return dir;
}

async function buildApp(permissions: string[] = [PERMISSIONS.PROJECTS_GENERATE], enabled = true) {
  const config = loadConfig({
    NODE_ENV: 'test',
    FEATURE_PROJECT_GENERATOR: enabled ? 'true' : 'false',
  });
  const generator = enabled
    ? createProjectGeneratorService({
        config,
        logger: pino({ level: 'silent' }),
        audit: new AuditService(createMemoryAuditStore()),
        kitRoot: await kitRoot(),
      })
    : null;
  const app = express();
  app.use(requestIdMiddleware);
  app.use(express.json({ limit: '1mb' }));
  const authenticate = (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = actor(permissions);
    next();
  };
  app.use(
    API_PREFIX,
    createProjectGeneratorRouter({
      controller: new ProjectGeneratorController(generator),
      authenticate,
    }),
  );
  app.use(errorHandler(pino({ level: 'silent' }), false));
  return app;
}

function approved() {
  return buildProjectConfiguration(
    {
      capabilities: [...AUTH_STACK],
      title: 'Auth Search',
      architectureMode: 'architecture.modular-monolith',
      deploymentMode: 'deployment.local-hybrid',
    },
    {
      intent: 'approve',
      userId: '11111111-1111-1111-1111-111111111111',
      id: () => 'cfg-auth-1',
      now: () => new Date('2026-09-04T12:00:00.000Z'),
    },
  );
}

describe('Project generator HTTP (authenticated, no database)', () => {
  it('previews and generates an approved configuration into generated/', async () => {
    const app = await buildApp();
    const configuration = approved();

    const preview = await request(app).post('/api/v1/project-generator/preview').send({ configuration });
    expect(preview.status).toBe(200);
    expect(preview.body.success).toBe(true);
    expect(preview.body.data.dryRun).toBe(true);
    expect(preview.body.data.contentDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(preview.body.data.files.length).toBeGreaterThan(10);

    const generated = await request(app).post('/api/v1/project-generator/generate').send({ configuration });
    expect(generated.status).toBe(200);
    expect(generated.body.data.dryRun).toBe(false);
    expect(generated.body.data.contentDigest).toBe(preview.body.data.contentDigest);
    expect(generated.body.data.relativeRoot.replaceAll('\\', '/')).toBe('generated/projects/auth-search');
  });

  it('denies callers without projects.generate', async () => {
    const app = await buildApp([]);
    const response = await request(app)
      .post('/api/v1/project-generator/preview')
      .send({ configuration: approved() });
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe(ERROR_CODES.AUTHORIZATION_ERROR);
  });

  it('rejects a draft configuration', async () => {
    const app = await buildApp();
    const draft = buildProjectConfiguration(
      { capabilities: [...AUTH_STACK] },
      { intent: 'validate', id: () => 'draft-1' },
    );
    const response = await request(app).post('/api/v1/project-generator/generate').send({ configuration: draft });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
  });

  it('rejects requests when the feature is disabled', async () => {
    const app = await buildApp([PERMISSIONS.PROJECTS_GENERATE], false);
    const response = await request(app)
      .post('/api/v1/project-generator/preview')
      .send({ configuration: approved() });
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe(ERROR_CODES.FEATURE_DISABLED);
  });
});
