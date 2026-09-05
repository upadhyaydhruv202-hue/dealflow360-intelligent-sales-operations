import { z } from 'zod';
import { describe, expect, it } from 'vitest';

import type { AuthenticatedUser } from '../auth/types';
import { AuditService, createMemoryAuditStore } from '../audit';
import { loadConfig } from '../config';
import { AUTOMATION } from '../constants';
import { AuthorizationError, ValidationError } from '../errors';
import { createEventBus } from '../events';
import { InMemoryJobQueue } from '../jobs';
import { PERMISSIONS } from '../rbac/catalog';
import { silentLogger } from '../integrations/ai/ai.test-helpers';
import { registerBuiltinTriggers } from './triggers/builtin';
import { createMemoryAutomationStore } from './automation.memory';
import { createAutomationRegistries } from './automation.registry';
import { createAutomationService } from './automation.service';
import { defineAutomationAction, type RegisteredAutomationAction } from './automation.types';
import { matchesConditions, createBuiltinConditionRegistry } from './automation.conditions';

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

const writer = actor([PERMISSIONS.AUTOMATIONS_WRITE, PERMISSIONS.AUTOMATIONS_EXECUTE]);

function noteAction(notes: string[]) {
  return defineAutomationAction({
    type: 'recordNote',
    description: 'Record a test note from the event payload',
    requiredPermission: PERMISSIONS.AUTOMATIONS_WRITE,
    destructive: false,
    inputSchema: z.object({
      type: z.literal('recordNote'),
      prefix: z.string().max(40).optional(),
    }),
    handler: async (input, context) => {
      const note = `${input.prefix ?? ''}${String(context.event.payload.note ?? 'ok')}`;
      notes.push(note);
      return { note };
    },
  });
}

function privilegedAction() {
  return defineAutomationAction({
    type: 'privilegedNote',
    description: 'Requires users.write',
    requiredPermission: PERMISSIONS.USERS_WRITE,
    destructive: false,
    inputSchema: z.object({ type: z.literal('privilegedNote') }),
    handler: async () => ({ leaked: true }),
  });
}

function failOnceAction(state: { attempts: number }) {
  return defineAutomationAction({
    type: 'flakyNote',
    description: 'Fails the first attempt',
    requiredPermission: PERMISSIONS.AUTOMATIONS_WRITE,
    destructive: false,
    inputSchema: z.object({ type: z.literal('flakyNote') }),
    handler: async () => {
      state.attempts += 1;
      if (state.attempts === 1) {
        throw new Error('provider exploded with api_key=super-secret');
      }
      return { recovered: true };
    },
  });
}

function alwaysFailAction() {
  return defineAutomationAction({
    type: 'brokenNote',
    description: 'Always fails',
    requiredPermission: PERMISSIONS.AUTOMATIONS_WRITE,
    destructive: false,
    inputSchema: z.object({ type: z.literal('brokenNote') }),
    handler: async () => {
      throw new Error('permanent failure');
    },
  });
}

function deleteAction(deleted: string[]) {
  return defineAutomationAction({
    type: 'updateRecord',
    description: 'Destructive demo updater',
    requiredPermission: PERMISSIONS.AUTOMATIONS_WRITE,
    destructive: true,
    inputSchema: z.object({
      type: z.literal('updateRecord'),
      resource: z.string(),
      id: z.string(),
      data: z.record(z.string(), z.unknown()),
    }),
    handler: async (input) => {
      deleted.push(input.id);
      return { id: input.id };
    },
  });
}

function build(
  actions: RegisteredAutomationAction[],
  jobs = new InMemoryJobQueue(silentLogger),
  extra: { events?: ReturnType<typeof createEventBus> } = {},
) {
  const config = loadConfig({
    NODE_ENV: 'test',
    FEATURE_AUTOMATION: 'true',
    DEMO_MODE: 'true',
  });
  const registries = createAutomationRegistries();
  registerBuiltinTriggers(registries.triggers);
  for (const action of actions) {
    registries.actions.register(action);
  }
  const store = createMemoryAutomationStore();
  const auditStore = createMemoryAuditStore();
  const automation = createAutomationService({
    config,
    logger: silentLogger,
    store,
    jobs,
    registries,
    events: extra.events,
    audit: new AuditService(auditStore),
  });
  return { automation, store, jobs, auditStore };
}

describe('automation conditions', () => {
  const operators = createBuiltinConditionRegistry();

  it('matches declarative operators without executing expressions', () => {
    const payload = { daysOverdue: 10, status: 'open', tags: ['late'], customer: { name: 'Ada' } };
    expect(
      matchesConditions(
        [{ field: 'daysOverdue', operator: 'greaterThan', value: 7 }],
        payload,
        operators,
      ),
    ).toBe(true);
    expect(
      matchesConditions(
        [{ field: 'daysOverdue', operator: 'greaterThan', value: 11 }],
        payload,
        operators,
      ),
    ).toBe(false);
    expect(
      matchesConditions(
        [{ field: 'status', operator: 'equals', value: 'open' }],
        payload,
        operators,
      ),
    ).toBe(true);
    expect(
      matchesConditions(
        [{ field: 'status', operator: 'notEquals', value: 'paid' }],
        payload,
        operators,
      ),
    ).toBe(true);
    expect(
      matchesConditions(
        [{ field: 'status', operator: 'contains', value: 'pe' }],
        payload,
        operators,
      ),
    ).toBe(true);
    expect(
      matchesConditions(
        [{ field: 'status', operator: 'in', value: ['open', 'late'] }],
        payload,
        operators,
      ),
    ).toBe(true);
    expect(
      matchesConditions([{ field: 'customer.name', operator: 'exists' }], payload, operators),
    ).toBe(true);
    expect(matchesConditions([{ field: 'missing', operator: 'exists' }], payload, operators)).toBe(
      false,
    );
    expect(
      matchesConditions([{ field: '__proto__.x', operator: 'exists' }], payload, operators),
    ).toBe(false);
  });
});

describe('automation engine', () => {
  it('runs a matching enabled rule and skips a non-matching rule', async () => {
    const notes: string[] = [];
    const { automation, jobs } = build([noteAction(notes)]);
    await automation.createRule(
      {
        name: 'Match overdue',
        trigger: 'invoice.overdue',
        enabled: true,
        priority: 10,
        conditions: [{ field: 'daysOverdue', operator: 'greaterThan', value: 7 }],
        actions: [{ type: 'recordNote', prefix: 'late:' }],
      },
      writer,
    );
    await automation.createRule(
      {
        name: 'No match',
        trigger: 'invoice.overdue',
        enabled: true,
        priority: 20,
        conditions: [{ field: 'daysOverdue', operator: 'greaterThan', value: 30 }],
        actions: [{ type: 'recordNote', prefix: 'skip:' }],
      },
      writer,
    );

    await automation.emitEvent({
      trigger: 'invoice.overdue',
      eventId: 'invoice.overdue:inv-1',
      payload: { daysOverdue: 10, note: 'send' },
    });
    await jobs.waitForIdle();
    expect(notes).toEqual(['late:send']);
  });

  it('does not run a disabled rule', async () => {
    const notes: string[] = [];
    const { automation, jobs } = build([noteAction(notes)]);
    await automation.createRule(
      {
        name: 'Disabled',
        trigger: 'invoice.overdue',
        enabled: false,
        conditions: [],
        actions: [{ type: 'recordNote' }],
      },
      writer,
    );
    await automation.emitEvent({
      trigger: 'invoice.overdue',
      eventId: 'invoice.overdue:disabled',
      payload: { note: 'nope' },
    });
    await jobs.waitForIdle();
    expect(notes).toEqual([]);
  });

  it('records action failure after retries are exhausted', async () => {
    const { automation, jobs, store } = build([alwaysFailAction()]);
    const rule = await automation.createRule(
      {
        name: 'Broken',
        trigger: 'invoice.overdue',
        enabled: true,
        actions: [{ type: 'brokenNote' }],
      },
      writer,
    );
    await automation.emitEvent({
      trigger: 'invoice.overdue',
      eventId: 'invoice.overdue:fail',
      payload: {},
    });
    await jobs.waitForIdle();
    const executions = await store.listExecutions({ ruleId: rule.id });
    expect(executions.items[0]?.status).toBe('failed');
    expect(executions.items[0]?.attempt).toBe(AUTOMATION.JOB_ATTEMPTS);
    expect(executions.items[0]?.errorMessage).toMatch(/permanent failure/);
  });

  it('retries a flaky action until it succeeds', async () => {
    const state = { attempts: 0 };
    const { automation, jobs, store } = build([failOnceAction(state)]);
    const rule = await automation.createRule(
      {
        name: 'Flaky',
        trigger: 'invoice.overdue',
        enabled: true,
        actions: [{ type: 'flakyNote' }],
      },
      writer,
    );
    await automation.emitEvent({
      trigger: 'invoice.overdue',
      eventId: 'invoice.overdue:retry',
      payload: {},
    });
    await jobs.waitForIdle();
    expect(state.attempts).toBe(2);
    const executions = await store.listExecutions({ ruleId: rule.id });
    expect(executions.items[0]?.status).toBe('succeeded');
  });

  it('is idempotent for a duplicate event id', async () => {
    const notes: string[] = [];
    const { automation, jobs, store } = build([noteAction(notes)]);
    const rule = await automation.createRule(
      {
        name: 'Once',
        trigger: 'invoice.overdue',
        enabled: true,
        actions: [{ type: 'recordNote' }],
      },
      writer,
    );
    const event = {
      trigger: 'invoice.overdue' as const,
      eventId: 'invoice.overdue:dup',
      payload: { note: 'one' },
    };
    await automation.emitEvent(event);
    await automation.emitEvent(event);
    await jobs.waitForIdle();
    expect(notes).toEqual(['one']);
    const executions = await store.listExecutions({ ruleId: rule.id });
    expect(executions.items).toHaveLength(1);
  });

  it('awaits matching and enqueue when emit goes through the event bus', async () => {
    const notes: string[] = [];
    const events = createEventBus();
    const { automation, jobs, store } = build(
      [noteAction(notes)],
      new InMemoryJobQueue(silentLogger),
      { events },
    );
    await automation.createRule(
      {
        name: 'From bus',
        trigger: 'webhook.received',
        enabled: true,
        actions: [{ type: 'recordNote' }],
      },
      writer,
    );
    await automation.emitEvent({
      trigger: 'webhook.received',
      eventId: 'webhook.received:bus-1',
      payload: { note: 'queued' },
    });
    await jobs.waitForIdle();
    expect(notes).toEqual(['queued']);
    const executions = await store.listExecutions({});
    expect(executions.items).toHaveLength(1);
    expect(executions.items[0]?.status).toBe('succeeded');
  });

  it('denies executing an action when the event actor lacks permission', async () => {
    const { automation, jobs, store } = build([privilegedAction()]);
    const admin = actor([PERMISSIONS.AUTOMATIONS_WRITE, PERMISSIONS.USERS_WRITE]);
    const rule = await automation.createRule(
      {
        name: 'Privileged',
        trigger: 'invoice.overdue',
        enabled: true,
        actions: [{ type: 'privilegedNote' }],
      },
      admin,
    );
    await automation.emitEvent(
      { trigger: 'invoice.overdue', eventId: 'invoice.overdue:auth', payload: {} },
      actor([PERMISSIONS.AUTOMATIONS_EXECUTE]),
    );
    await jobs.waitForIdle();
    const executions = await store.listExecutions({ ruleId: rule.id });
    expect(executions.items[0]?.status).toBe('failed');
  });

  it('rejects invalid rules and destructive actions without policy', async () => {
    const { automation } = build([noteAction([]), deleteAction([]), privilegedAction()]);
    await expect(
      automation.createRule(
        { name: 'Bad trigger', trigger: 'not.registered', actions: [{ type: 'recordNote' }] },
        writer,
      ),
    ).rejects.toBeInstanceOf(ValidationError);

    await expect(
      automation.createRule(
        {
          name: 'Bad operator',
          trigger: 'invoice.overdue',
          conditions: [{ field: 'daysOverdue', operator: 'eval', value: '1==1' }],
          actions: [{ type: 'recordNote' }],
        },
        writer,
      ),
    ).rejects.toBeInstanceOf(ValidationError);

    await expect(
      automation.createRule(
        {
          name: 'Destructive',
          trigger: 'invoice.overdue',
          allowDestructive: false,
          actions: [
            { type: 'updateRecord', resource: 'demo.invoice', id: '1', data: { status: 'void' } },
          ],
        },
        writer,
      ),
    ).rejects.toBeInstanceOf(ValidationError);

    await expect(
      automation.createRule(
        {
          name: 'No permission',
          trigger: 'invoice.overdue',
          actions: [{ type: 'privilegedNote' }],
        },
        writer,
      ),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it('requires validation before enabling an AI-generated rule', async () => {
    const { automation } = build([noteAction([])]);
    const rule = await automation.createRule(
      {
        name: 'From AI',
        trigger: 'invoice.overdue',
        source: 'ai',
        enabled: true,
        actions: [{ type: 'recordNote' }],
      },
      writer,
    );
    expect(rule.enabled).toBe(false);
    await expect(automation.enableRule(rule.id, writer)).rejects.toBeInstanceOf(ValidationError);
    const validated = await automation.validateRule(rule.id, writer);
    expect(validated.validatedAt).toBeInstanceOf(Date);
    const enabled = await automation.enableRule(rule.id, writer);
    expect(enabled.enabled).toBe(true);
  });

  it('runs higher priority rules first', async () => {
    const notes: string[] = [];
    const { automation, jobs } = build([noteAction(notes)]);
    await automation.createRule(
      {
        name: 'Second',
        trigger: 'invoice.overdue',
        enabled: true,
        priority: 50,
        actions: [{ type: 'recordNote', prefix: 'b:' }],
      },
      writer,
    );
    await automation.createRule(
      {
        name: 'First',
        trigger: 'invoice.overdue',
        enabled: true,
        priority: 1,
        actions: [{ type: 'recordNote', prefix: 'a:' }],
      },
      writer,
    );
    await automation.emitEvent({
      trigger: 'invoice.overdue',
      eventId: 'invoice.overdue:order',
      payload: { note: 'x' },
    });
    await jobs.waitForIdle();
    expect(notes).toEqual(['a:x', 'b:x']);
  });
});
