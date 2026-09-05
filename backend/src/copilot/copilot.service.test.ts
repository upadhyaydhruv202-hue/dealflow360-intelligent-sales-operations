import { z } from 'zod';
import { describe, expect, it } from 'vitest';

import type { AuthenticatedUser } from '../auth/types';
import { AuditService, createMemoryAuditStore } from '../audit';
import { loadConfig } from '../config';
import { ValidationError } from '../errors';
import { createTestService, silentLogger } from '../integrations/ai/ai.test-helpers';
import { PERMISSIONS } from '../rbac/catalog';
import { createMemoryCopilotConversations } from './copilot.memory';
import { createCopilotToolRegistry } from './copilot.registry';
import { createCopilotService } from './copilot.service';
import { defineCopilotTool, type RegisteredCopilotTool } from './copilot.types';

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

function echoTool() {
  return defineCopilotTool({
    name: 'echoLookup',
    description: 'Echo a demo record by id',
    requiredPermission: PERMISSIONS.COPILOT_USE,
    riskLevel: 'low',
    inputSchema: z.object({ id: z.string().uuid() }),
    handler: async (input) => ({ id: input.id, ok: true }),
  });
}

function privilegedTool() {
  return defineCopilotTool({
    name: 'secretAdminTool',
    description: 'A privileged demo tool',
    requiredPermission: PERMISSIONS.USERS_WRITE,
    riskLevel: 'low',
    inputSchema: z.object({ note: z.string().min(1).max(40) }),
    handler: async () => ({ leaked: true }),
  });
}

function deleteTool(onRun: () => void) {
  return defineCopilotTool({
    name: 'deleteRecord',
    description: 'Delete a demo record',
    requiredPermission: PERMISSIONS.COPILOT_USE,
    riskLevel: 'high',
    inputSchema: z.object({ id: z.string().min(1).max(64) }),
    handler: async (input) => {
      onRun();
      return { id: input.id, deleted: true };
    },
  });
}

function failingTool() {
  return defineCopilotTool({
    name: 'unstableLookup',
    description: 'Fails on purpose',
    requiredPermission: PERMISSIONS.COPILOT_USE,
    riskLevel: 'low',
    inputSchema: z.object({ id: z.string().min(1) }),
    handler: async () => {
      throw new Error('provider exploded with api_key=super-secret');
    },
  });
}

function build(tools: RegisteredCopilotTool[]) {
  const config = loadConfig({
    NODE_ENV: 'test',
    FEATURE_COPILOT: 'true',
    AI_ENABLED: 'true',
    AI_PROVIDER: 'mock',
    DEMO_MODE: 'true',
  });
  const { service: ai, provider } = createTestService();
  const conversations = createMemoryCopilotConversations();
  const store = createMemoryAuditStore();
  const audit = new AuditService(store);
  const copilot = createCopilotService({
    config,
    logger: silentLogger,
    ai,
    registry: createCopilotToolRegistry(tools),
    conversations,
    audit,
  });

  return { copilot, provider, audit, store, conversations };
}

function plan(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    intent: 'answer',
    reply: 'Here is a direct answer.',
    tools: [],
    confidence: 0.91,
    evidence: 'No tool was required.',
    ...overrides,
  });
}

describe('CopilotService', () => {
  const user = actor([PERMISSIONS.COPILOT_USE]);

  it('answers a normal question without tools', async () => {
    const { copilot, provider } = build([echoTool()]);
    provider.enqueue(plan());

    const result = await copilot.chat({ user, message: 'What can you do?' });

    expect(result.status).toBe('completed');
    expect(result.tools).toEqual([]);
    expect(result.message.content).toMatch(/direct answer/i);
    expect(result.message.confidence).toBe(0.91);
    expect(result.conversationId).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it('invokes an allowlisted tool after schema validation', async () => {
    const { copilot, provider, store } = build([echoTool()]);
    const id = '22222222-2222-2222-2222-222222222222';
    provider.enqueue(
      plan({
        intent: 'tool',
        reply: 'Looking that up.',
        tools: [{ name: 'echoLookup', arguments: { id } }],
      }),
    );

    const result = await copilot.chat({ user, message: 'Look up the record' });

    expect(result.status).toBe('completed');
    expect(result.tools).toEqual([
      expect.objectContaining({ name: 'echoLookup', status: 'success', result: { id, ok: true } }),
    ]);
    expect(store.events).toEqual([
      expect.objectContaining({ action: 'copilot.tool', resource: 'echoLookup', status: 'success' }),
    ]);
  });

  it('denies a tool the user is not allowed to use', async () => {
    const { copilot, provider, store } = build([privilegedTool()]);
    provider.enqueue(
      plan({
        intent: 'tool',
        reply: 'Trying a privileged tool.',
        tools: [{ name: 'secretAdminTool', arguments: { note: 'nope' } }],
      }),
    );

    const result = await copilot.chat({ user, message: 'Do the admin thing' });

    expect(result.status).toBe('completed');
    expect(result.tools[0]).toMatchObject({ name: 'secretAdminTool', status: 'denied' });
    expect(result.tools[0]?.result).toBeUndefined();
    expect(store.events[0]?.status).toBe('denied');
  });

  it('rejects invalid tool arguments', async () => {
    const { copilot, provider } = build([echoTool()]);
    provider.enqueue(
      plan({
        intent: 'tool',
        reply: 'Looking that up.',
        tools: [{ name: 'echoLookup', arguments: { id: 'not-a-uuid' } }],
      }),
    );

    const result = await copilot.chat({ user, message: 'Look up the record' });

    expect(result.tools[0]).toMatchObject({ name: 'echoLookup', status: 'invalid_arguments' });
  });

  it('requires confirmation before a destructive tool runs', async () => {
    let ran = 0;
    const { copilot, provider } = build([deleteTool(() => ran += 1)]);
    provider.enqueue(
      plan({
        intent: 'tool',
        reply: 'This needs confirmation.',
        tools: [{ name: 'deleteRecord', arguments: { id: 'cust-1001' } }],
      }),
    );

    const pending = await copilot.chat({ user, message: 'Delete customer cust-1001' });
    expect(pending.status).toBe('pending_confirmation');
    expect(pending.tools[0]?.status).toBe('pending_confirmation');
    expect(ran).toBe(0);

    const confirmed = await copilot.chat({
      user,
      conversationId: pending.conversationId,
      confirm: true,
    });
    expect(confirmed.status).toBe('completed');
    expect(confirmed.tools[0]).toMatchObject({ name: 'deleteRecord', status: 'success' });
    expect(ran).toBe(1);

    await expect(
      copilot.chat({
        user,
        conversationId: pending.conversationId,
        confirm: true,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(ran).toBe(1);
  });

  it('returns a recoverable error when the planner fails', async () => {
    const { copilot, provider } = build([echoTool()]);
    provider.enqueue(new Error('gemini timeout'));

    const result = await copilot.chat({ user, message: 'Hello' });

    expect(result.status).toBe('error');
    expect(result.message.content).toMatch(/could not complete/i);
    expect(result.tools).toEqual([]);
  });

  it('records a tool failure without leaking secrets', async () => {
    const { copilot, provider, store } = build([failingTool()]);
    provider.enqueue(
      plan({
        intent: 'tool',
        reply: 'Trying the lookup.',
        tools: [{ name: 'unstableLookup', arguments: { id: 'x', apiKey: 'should-not-last' } }],
      }),
    );

    const result = await copilot.chat({ user, message: 'Look this up' });

    expect(result.tools[0]?.status).toBe('failed');
    expect(result.tools[0]?.error).toBe('The tool failed');
    expect(JSON.stringify(result)).not.toMatch(/super-secret|should-not-last/i);
    expect(store.events[0]?.request).toEqual({ id: 'x', apiKey: '[Redacted]' });
  });

  it('does not store secrets in conversation history', async () => {
    const { copilot, provider, conversations } = build([echoTool()]);
    provider.enqueue(plan());

    const result = await copilot.chat({
      user,
      message: 'Reset with password=hunter2 and api_key=abcdef',
    });
    const messages = await conversations.listMessages(result.conversationId);
    const serialized = JSON.stringify(messages);
    expect(serialized).not.toMatch(/abcdef|hunter2/);
    expect(serialized).toMatch(/\[Redacted\]/i);
  });
});

describe('CopilotToolRegistry', () => {
  it('rejects duplicate and forbidden tool names', () => {
    const registry = createCopilotToolRegistry();
    registry.register(echoTool());
    expect(() => registry.register(echoTool())).toThrow(ValidationError);
    expect(() =>
      registry.register({
        ...echoTool(),
        name: 'executeSql',
      }),
    ).toThrow(/arbitrary execution/i);
  });
});
