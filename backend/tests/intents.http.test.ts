import express from 'express';
import pino from 'pino';
import request from 'supertest';
import { z } from 'zod';
import { describe, expect, it } from 'vitest';

import type { AuthenticatedUser } from '../src/auth/types';
import { AuditService, createMemoryAuditStore } from '../src/audit';
import { API_PREFIX, ERROR_CODES } from '../src/constants';
import { IntentsController } from '../src/controllers/intents.controller';
import {
  createIntentRegistry,
  createIntentService,
  createMemoryIntentConfirmations,
  defineIntent,
} from '../src/intents';
import { loadConfig } from '../src/config';
import { createTestService, silentLogger } from '../src/integrations/ai/ai.test-helpers';
import { errorHandler, requestIdMiddleware } from '../src/middleware';
import { PERMISSIONS } from '../src/rbac/catalog';
import { createIntentsRouter } from '../src/routes/intents.routes';

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

function searchIntent() {
  return defineIntent({
    name: 'SEARCH_ORDERS',
    description: 'Search demo orders',
    requiredPermission: PERMISSIONS.INTENTS_USE,
    riskLevel: 'low',
    inputSchema: z.object({
      status: z.string().optional(),
    }),
    handler: async (input) => ({ ok: true, status: input.status ?? null }),
  });
}

function buildApp(permissions: string[] = [PERMISSIONS.INTENTS_USE]) {
  const config = loadConfig({
    NODE_ENV: 'test',
    FEATURE_INTENTS: 'true',
    AI_ENABLED: 'true',
    AI_PROVIDER: 'mock',
    DEMO_MODE: 'true',
  });
  const { service: ai, provider } = createTestService();
  const intents = createIntentService({
    config,
    logger: silentLogger,
    ai,
    registry: createIntentRegistry([searchIntent()]),
    confirmations: createMemoryIntentConfirmations(),
    audit: new AuditService(createMemoryAuditStore()),
  });
  const app = express();
  app.use(requestIdMiddleware);
  app.use(express.json());
  app.use(
    API_PREFIX,
    createIntentsRouter({
      controller: new IntentsController(intents),
      authenticate: (req, _res, next) => {
        req.user = actor(permissions);
        next();
      },
    }),
  );
  app.use(errorHandler(pino({ level: 'silent' }), false));
  return { app, provider };
}

describe('Intent HTTP (authenticated, no database)', () => {
  it('lists intents and executes a valid command', async () => {
    const { app, provider } = buildApp();
    provider.enqueue(
      JSON.stringify({
        intent: 'SEARCH_ORDERS',
        input: { status: 'pending' },
        confidence: 0.9,
        ambiguous: false,
        candidates: [],
      }),
    );

    const catalog = await request(app).get('/api/v1/intents');
    expect(catalog.status).toBe(200);
    expect(catalog.body.data.intents).toEqual([
      expect.objectContaining({ name: 'SEARCH_ORDERS', requiredPermission: PERMISSIONS.INTENTS_USE }),
    ]);

    const executed = await request(app)
      .post('/api/v1/intents/execute')
      .send({ utterance: 'Show pending orders' });
    expect(executed.status).toBe(200);
    expect(executed.body.data.status).toBe('completed');
    expect(executed.body.data.command.intent).toBe('SEARCH_ORDERS');
    expect(executed.body.data.result).toEqual({ ok: true, status: 'pending' });
  });

  it('denies callers without intents.use', async () => {
    const { app } = buildApp([]);
    const response = await request(app).post('/api/v1/intents/execute').send({ utterance: 'Show pending orders' });
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe(ERROR_CODES.AUTHORIZATION_ERROR);
  });

  it('rejects an execute call with neither an utterance nor confirmation', async () => {
    const { app } = buildApp();
    const response = await request(app).post('/api/v1/intents/execute').send({});
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
  });

  it('rejects a confirmation token that is not a UUID', async () => {
    const { app } = buildApp();
    const response = await request(app)
      .post('/api/v1/intents/execute')
      .send({ confirm: true, confirmationToken: 'not-a-uuid' });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
  });
});
