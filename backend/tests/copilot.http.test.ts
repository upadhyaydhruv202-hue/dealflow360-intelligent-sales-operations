import express from 'express';
import pino from 'pino';
import request from 'supertest';
import { z } from 'zod';
import { describe, expect, it } from 'vitest';

import type { AuthenticatedUser } from '../src/auth/types';
import { AuditService, createMemoryAuditStore } from '../src/audit';
import { API_PREFIX, ERROR_CODES } from '../src/constants';
import { CopilotController } from '../src/controllers/copilot.controller';
import { createCopilotService, createCopilotToolRegistry, createMemoryCopilotConversations, defineCopilotTool } from '../src/copilot';
import { loadConfig } from '../src/config';
import { createTestService, silentLogger } from '../src/integrations/ai/ai.test-helpers';
import { errorHandler, requestIdMiddleware } from '../src/middleware';
import { PERMISSIONS } from '../src/rbac/catalog';
import { createCopilotRouter } from '../src/routes/copilot.routes';

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

function pingTool() {
  return defineCopilotTool({
    name: 'echoLookup',
    description: 'Echo a demo id',
    requiredPermission: PERMISSIONS.COPILOT_USE,
    riskLevel: 'low',
    inputSchema: z.object({ id: z.string().min(1).max(64) }),
    handler: async (input) => ({ id: input.id }),
  });
}

function buildApp(permissions: string[] = [PERMISSIONS.COPILOT_USE]) {
  const config = loadConfig({
    NODE_ENV: 'test',
    FEATURE_COPILOT: 'true',
    AI_ENABLED: 'true',
    AI_PROVIDER: 'mock',
    DEMO_MODE: 'true',
  });
  const { service: ai, provider } = createTestService();
  const copilot = createCopilotService({
    config,
    logger: silentLogger,
    ai,
    registry: createCopilotToolRegistry([pingTool()]),
    conversations: createMemoryCopilotConversations(),
    audit: new AuditService(createMemoryAuditStore()),
  });
  const app = express();
  app.use(requestIdMiddleware);
  app.use(express.json());
  app.use(
    API_PREFIX,
    createCopilotRouter({
      controller: new CopilotController(copilot),
      authenticate: (req, _res, next) => {
        req.user = actor(permissions);
        next();
      },
    }),
  );
  app.use(errorHandler(pino({ level: 'silent' }), false));
  return { app, provider };
}

describe('Copilot HTTP (authenticated, no database)', () => {
  it('lists tools and answers a chat turn', async () => {
    const { app, provider } = buildApp();
    provider.enqueue(
      JSON.stringify({
        intent: 'answer',
        reply: 'Copilot is ready.',
        tools: [],
        confidence: 0.9,
      }),
    );

    const tools = await request(app).get('/api/v1/copilot/tools');
    expect(tools.status).toBe(200);
    expect(tools.body.data.tools).toEqual([
      expect.objectContaining({ name: 'echoLookup', requiredPermission: PERMISSIONS.COPILOT_USE }),
    ]);

    const chat = await request(app).post('/api/v1/copilot/chat').send({ message: 'Hello' });
    expect(chat.status).toBe(200);
    expect(chat.body.data.status).toBe('completed');
    expect(chat.body.data.message.content).toMatch(/ready/i);
  });

  it('invokes a tool over HTTP', async () => {
    const { app, provider } = buildApp();
    provider.enqueue(
      JSON.stringify({
        intent: 'tool',
        reply: 'Looking it up.',
        tools: [{ name: 'echoLookup', arguments: { id: 'abc' } }],
        confidence: 0.8,
      }),
    );

    const chat = await request(app).post('/api/v1/copilot/chat').send({ message: 'Find abc' });
    expect(chat.status).toBe(200);
    expect(chat.body.data.tools[0]).toMatchObject({ name: 'echoLookup', status: 'success', result: { id: 'abc' } });
  });

  it('denies callers without copilot.use', async () => {
    const { app } = buildApp([]);
    const response = await request(app).post('/api/v1/copilot/chat').send({ message: 'Hello' });
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe(ERROR_CODES.AUTHORIZATION_ERROR);
  });

  it('rejects a chat turn with neither a message nor confirmation', async () => {
    const { app } = buildApp();
    const response = await request(app).post('/api/v1/copilot/chat').send({});
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
  });

  it('clears a conversation', async () => {
    const { app, provider } = buildApp();
    provider.enqueue(
      JSON.stringify({
        intent: 'answer',
        reply: 'Hi.',
        tools: [],
        confidence: 0.9,
      }),
    );

    const chat = await request(app).post('/api/v1/copilot/chat').send({ message: 'Hello' });
    const id = chat.body.data.conversationId as string;
    const cleared = await request(app).post(`/api/v1/copilot/conversations/${id}/clear`);
    expect(cleared.status).toBe(200);
    expect(cleared.body.data).toEqual({ id, cleared: true });

    const loaded = await request(app).get(`/api/v1/copilot/conversations/${id}`);
    expect(loaded.body.data.messages).toEqual([]);
  });
});
