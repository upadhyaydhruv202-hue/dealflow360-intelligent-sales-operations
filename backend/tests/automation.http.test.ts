import express from 'express';
import pino from 'pino';
import request from 'supertest';
import { z } from 'zod';
import { describe, expect, it } from 'vitest';

import type { AuthenticatedUser } from '../src/auth/types';
import { AuditService, createMemoryAuditStore } from '../src/audit';
import { createAutomationService, createAutomationRegistries, createMemoryAutomationStore, defineAutomationAction } from '../src/automation';
import { registerBuiltinTriggers } from '../src/automation/triggers/builtin';
import { API_PREFIX, ERROR_CODES } from '../src/constants';
import { AutomationController } from '../src/controllers/automation.controller';
import { loadConfig } from '../src/config';
import { silentLogger } from '../src/integrations/ai/ai.test-helpers';
import { InMemoryJobQueue } from '../src/jobs';
import { errorHandler, requestIdMiddleware } from '../src/middleware';
import { PERMISSIONS } from '../src/rbac/catalog';
import { createAutomationRouter } from '../src/routes/automation.routes';

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

function recordNoteAction() {
  return defineAutomationAction({
    type: 'recordNote',
    description: 'Record a demo note',
    requiredPermission: PERMISSIONS.AUTOMATIONS_WRITE,
    destructive: false,
    inputSchema: z.object({ type: z.literal('recordNote') }),
    handler: async () => ({ ok: true }),
  });
}

function buildApp(permissions: string[]) {
  const config = loadConfig({
    NODE_ENV: 'test',
    FEATURE_AUTOMATION: 'true',
    DEMO_MODE: 'true',
  });
  const registries = createAutomationRegistries();
  registerBuiltinTriggers(registries.triggers);
  registries.actions.register(recordNoteAction());
  const jobs = new InMemoryJobQueue(silentLogger);
  const automation = createAutomationService({
    config,
    logger: silentLogger,
    store: createMemoryAutomationStore(),
    jobs,
    registries,
    audit: new AuditService(createMemoryAuditStore()),
  });
  const app = express();
  app.use(requestIdMiddleware);
  app.use(express.json());
  app.use(
    API_PREFIX,
    createAutomationRouter({
      controller: new AutomationController(automation),
      authenticate: (req, _res, next) => {
        req.user = actor(permissions);
        next();
      },
    }),
  );
  app.use(errorHandler(pino({ level: 'silent' }), false));
  return { app, jobs };
}

describe('Automation HTTP (authenticated, no database)', () => {
  it('lists catalog and creates an enabled rule', async () => {
    const { app } = buildApp([PERMISSIONS.AUTOMATIONS_READ, PERMISSIONS.AUTOMATIONS_WRITE]);
    const catalog = await request(app).get('/api/v1/automations/catalog');
    expect(catalog.status).toBe(200);
    expect(catalog.body.data.triggers).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'invoice.overdue' })]),
    );

    const created = await request(app)
      .post('/api/v1/automations/rules')
      .send({
        name: 'Remind late invoices',
        trigger: 'invoice.overdue',
        enabled: true,
        conditions: [{ field: 'daysOverdue', operator: 'greaterThan', value: 7 }],
        actions: [{ type: 'recordNote' }],
      });
    expect(created.status).toBe(201);
    expect(created.body.data.enabled).toBe(true);
    expect(created.body.data.trigger).toBe('invoice.overdue');
  });

  it('rejects an invalid rule', async () => {
    const { app } = buildApp([PERMISSIONS.AUTOMATIONS_WRITE]);
    const response = await request(app).post('/api/v1/automations/rules').send({
      name: 'Bad',
      trigger: 'invoice.overdue',
      conditions: [{ field: 'daysOverdue', operator: 'eval', value: 'true' }],
      actions: [{ type: 'recordNote' }],
    });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
  });

  it('denies callers without automations.write', async () => {
    const { app } = buildApp([PERMISSIONS.AUTOMATIONS_READ]);
    const response = await request(app).post('/api/v1/automations/rules').send({
      name: 'Nope',
      trigger: 'invoice.overdue',
      actions: [{ type: 'recordNote' }],
    });
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe(ERROR_CODES.AUTHORIZATION_ERROR);
  });

  it('emits an event and records an execution', async () => {
    const { app, jobs } = buildApp([
      PERMISSIONS.AUTOMATIONS_READ,
      PERMISSIONS.AUTOMATIONS_WRITE,
      PERMISSIONS.AUTOMATIONS_EXECUTE,
    ]);
    const created = await request(app)
      .post('/api/v1/automations/rules')
      .send({
        name: 'On webhook',
        trigger: 'webhook.received',
        enabled: true,
        actions: [{ type: 'recordNote' }],
      });
    expect(created.status).toBe(201);

    const emitted = await request(app).post('/api/v1/automations/events').send({
      trigger: 'webhook.received',
      eventId: 'webhook.received:http-1',
      payload: { source: 'test' },
    });
    expect(emitted.status).toBe(202);
    await jobs.waitForIdle();

    const executions = await request(app).get('/api/v1/automations/executions');
    expect(executions.status).toBe(200);
    expect(executions.body.data.items[0].status).toBe('succeeded');
  });
});
