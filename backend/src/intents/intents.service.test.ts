import { z } from 'zod';
import { describe, expect, it } from 'vitest';

import type { AuthenticatedUser } from '../auth/types';
import { AuditService, createMemoryAuditStore } from '../audit';
import { loadConfig } from '../config';
import { ValidationError } from '../errors';
import { createTestService, silentLogger } from '../integrations/ai/ai.test-helpers';
import { PERMISSIONS } from '../rbac/catalog';
import { createDefaultIntentRegistry } from './catalog';
import { createIntentRegistry, FORBIDDEN_INTENT_NAME } from './intents.registry';
import { createMemoryIntentConfirmations } from './intents.pending';
import { createIntentService } from './intents.service';
import { defineIntent, type RegisteredIntent } from './intents.types';

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

function searchOrdersIntent() {
  return defineIntent({
    name: 'SEARCH_ORDERS',
    description: 'Search demo orders',
    requiredPermission: PERMISSIONS.INTENTS_USE,
    riskLevel: 'low',
    actionKind: 'read',
    inputSchema: z.object({
      status: z.enum(['pending', 'processing', 'delivered']).optional(),
      amountGreaterThan: z.number().nonnegative().optional(),
      dateRange: z.enum(['current_month', 'last_month']).optional(),
    }),
    handler: async (input) => ({ filters: input, items: [{ id: 'ord-5004', total: 62_500, status: 'pending' }] }),
  });
}

function privilegedIntent() {
  return defineIntent({
    name: 'GENERATE_REPORT',
    description: 'Generate a privileged report',
    requiredPermission: PERMISSIONS.REPORTS_GENERATE,
    riskLevel: 'low',
    inputSchema: z.object({
      title: z.string().min(1).max(80),
    }),
    handler: async () => ({ leaked: true }),
  });
}

function deleteIntent(onRun: () => void) {
  return defineIntent({
    name: 'DELETE_RECORD',
    description: 'Delete a demo record',
    requiredPermission: PERMISSIONS.INTENTS_USE,
    riskLevel: 'high',
    highRiskClass: 'DELETE',
    inputSchema: z.object({ id: z.string().min(1).max(64) }),
    handler: async (input) => {
      onRun();
      return { id: input.id, deleted: true };
    },
  });
}

function financialIntent(onRun: () => void) {
  return defineIntent({
    name: 'APPLY_CREDIT',
    description: 'Apply a financial credit',
    requiredPermission: PERMISSIONS.INTENTS_USE,
    riskLevel: 'high',
    highRiskClass: 'FINANCIAL_ACTION',
    inputSchema: z.object({
      invoiceId: z.string().min(1),
      amount: z.number().positive(),
    }),
    handler: async (input) => {
      onRun();
      return input;
    },
  });
}

function build(intents: RegisteredIntent[]) {
  const config = loadConfig({
    NODE_ENV: 'test',
    FEATURE_INTENTS: 'true',
    AI_ENABLED: 'true',
    AI_PROVIDER: 'mock',
    DEMO_MODE: 'true',
  });
  const { service: ai, provider } = createTestService();
  const store = createMemoryAuditStore();
  const audit = new AuditService(store);
  const service = createIntentService({
    config,
    logger: silentLogger,
    ai,
    registry: createIntentRegistry(intents),
    confirmations: createMemoryIntentConfirmations(),
    audit,
  });
  return { service, provider, store };
}

function extracted(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    intent: 'SEARCH_ORDERS',
    input: { status: 'pending', amountGreaterThan: 50_000, dateRange: 'current_month' },
    confidence: 0.92,
    evidence: 'The user asked for pending high-value orders this month.',
    ambiguous: false,
    candidates: [],
    ...overrides,
  });
}

describe('IntentService', () => {
  const user = actor([PERMISSIONS.INTENTS_USE]);

  it('executes a valid allowlisted intent after schema validation', async () => {
    const { service, provider, store } = build([searchOrdersIntent()]);
    provider.enqueue(extracted());

    const result = await service.execute({
      user,
      utterance: 'Show pending orders above ₹50,000 this month.',
    });

    expect(result.status).toBe('completed');
    expect(result.command).toEqual({
      intent: 'SEARCH_ORDERS',
      input: { status: 'pending', amountGreaterThan: 50_000, dateRange: 'current_month' },
    });
    expect(result.result).toEqual({
      filters: { status: 'pending', amountGreaterThan: 50_000, dateRange: 'current_month' },
      items: [{ id: 'ord-5004', total: 62_500, status: 'pending' }],
    });
    expect(store.events).toEqual([
      expect.objectContaining({
        action: 'intent.execute',
        resource: 'SEARCH_ORDERS',
        status: 'completed',
      }),
    ]);
    expect(store.events[0]?.request).toEqual(
      expect.objectContaining({
        utterance: expect.stringMatching(/pending orders/i),
        intent: 'SEARCH_ORDERS',
        authorized: true,
        outcome: 'completed',
      }),
    );
  });

  it('rejects an invalid intent that is not in the allowlist', async () => {
    const { service, provider, store } = build([searchOrdersIntent()]);
    provider.enqueue(
      extracted({
        intent: 'EXECUTE_SQL',
        input: { sql: 'drop table users' },
        confidence: 0.99,
      }),
    );

    const result = await service.execute({ user, utterance: 'Run this SQL' });

    expect(result.status).toBe('invalid');
    expect(result.error).toMatch(/allowlist/i);
    expect(result.result).toBeUndefined();
    expect(store.events[0]).toEqual(expect.objectContaining({ status: 'invalid', resource: 'EXECUTE_SQL' }));
  });

  it('returns invalid when the model returns a malformed structured response', async () => {
    const { service, provider } = build([searchOrdersIntent()]);
    provider.enqueue('this is not json {{{');
    provider.enqueue('this is not json {{{');

    const result = await service.execute({ user, utterance: 'Show pending orders' });

    expect(result.status).toBe('invalid');
    expect(result.error).toMatch(/valid structured command/i);
  });

  it('denies an intent the user is not allowed to run', async () => {
    const { service, provider, store } = build([privilegedIntent()]);
    provider.enqueue(
      extracted({
        intent: 'GENERATE_REPORT',
        input: { title: 'Secret' },
        confidence: 0.9,
      }),
    );

    const result = await service.execute({ user, utterance: 'Generate a report' });

    expect(result.status).toBe('denied');
    expect(result.authorized).toBe(false);
    expect(result.result).toBeUndefined();
    expect(store.events[0]).toEqual(
      expect.objectContaining({ resource: 'GENERATE_REPORT', status: 'denied' }),
    );
  });

  it('requires confirmation before a destructive intent runs', async () => {
    let ran = 0;
    const { service, provider } = build([deleteIntent(() => {
      ran += 1;
    })]);
    provider.enqueue(
      extracted({
        intent: 'DELETE_RECORD',
        input: { id: 'ord-5003' },
        confidence: 0.9,
      }),
    );

    const pending = await service.execute({ user, utterance: 'Delete order ord-5003' });
    expect(pending.status).toBe('pending_confirmation');
    expect(pending.confirmationToken).toMatch(/^[0-9a-f-]{36}$/i);
    expect(pending.highRiskClass).toBe('DELETE');
    expect(ran).toBe(0);

    const confirmed = await service.execute({
      user,
      confirm: true,
      confirmationToken: pending.confirmationToken,
    });
    expect(confirmed.status).toBe('completed');
    expect(confirmed.result).toEqual({ id: 'ord-5003', deleted: true });
    expect(ran).toBe(1);
  });

  it('requires confirmation for financial actions', async () => {
    let ran = 0;
    const { service, provider } = build([financialIntent(() => {
      ran += 1;
    })]);
    provider.enqueue(
      extracted({
        intent: 'APPLY_CREDIT',
        input: { invoiceId: 'inv-9002', amount: 100 },
        confidence: 0.88,
      }),
    );

    const pending = await service.execute({ user, utterance: 'Apply a 100 credit' });
    expect(pending.status).toBe('pending_confirmation');
    expect(pending.highRiskClass).toBe('FINANCIAL_ACTION');
    expect(ran).toBe(0);
  });

  it('returns ambiguous when the request cannot be mapped to one intent', async () => {
    const { service, provider, store } = build([searchOrdersIntent()]);
    provider.enqueue(
      extracted({
        intent: 'UNKNOWN',
        input: {},
        confidence: 0.4,
        ambiguous: true,
        candidates: ['SEARCH_ORDERS', 'GET_INVOICE'],
        clarification: 'Did you mean search orders or get an invoice?',
      }),
    );

    const result = await service.execute({ user, utterance: 'Do the thing with the numbers' });

    expect(result.status).toBe('ambiguous');
    expect(result.candidates).toEqual(['SEARCH_ORDERS', 'GET_INVOICE']);
    expect(result.result).toBeUndefined();
    expect(store.events[0]).toEqual(expect.objectContaining({ status: 'ambiguous' }));
  });

  it('treats low-confidence parses as ambiguous even when an intent is named', async () => {
    const { service, provider } = build([searchOrdersIntent()]);
    provider.enqueue(extracted({ confidence: 0.2 }));

    const result = await service.execute({ user, utterance: 'maybe orders?' });
    expect(result.status).toBe('ambiguous');
  });

  it('rejects invalid arguments against the intent schema', async () => {
    const { service, provider } = build([searchOrdersIntent()]);
    provider.enqueue(
      extracted({
        input: { status: 'not-a-status', amountGreaterThan: -5 },
      }),
    );

    const result = await service.execute({ user, utterance: 'Show weird orders' });
    expect(result.status).toBe('invalid');
    expect(result.error).toMatch(/schema validation/i);
  });

  it('does not execute a confirmation token belonging to another user', async () => {
    let ran = 0;
    const { service, provider } = build([deleteIntent(() => {
      ran += 1;
    })]);
    provider.enqueue(
      extracted({
        intent: 'DELETE_RECORD',
        input: { id: 'ord-5003' },
        confidence: 0.9,
      }),
    );
    const pending = await service.execute({ user, utterance: 'Delete order ord-5003' });

    const other = actor([PERMISSIONS.INTENTS_USE]);
    other.id = '22222222-2222-2222-2222-222222222222';

    await expect(
      service.execute({
        user: other,
        confirm: true,
        confirmationToken: pending.confirmationToken,
      }),
    ).rejects.toThrow(ValidationError);
    expect(ran).toBe(0);

    const confirmed = await service.execute({
      user,
      confirm: true,
      confirmationToken: pending.confirmationToken,
    });
    expect(confirmed.status).toBe('completed');
    expect(ran).toBe(1);
  });

  it('rejects a replayed confirmation token', async () => {
    let ran = 0;
    const { service, provider } = build([deleteIntent(() => {
      ran += 1;
    })]);
    provider.enqueue(
      extracted({
        intent: 'DELETE_RECORD',
        input: { id: 'ord-5003' },
        confidence: 0.9,
      }),
    );
    const pending = await service.execute({ user, utterance: 'Delete order ord-5003' });
    await service.execute({
      user,
      confirm: true,
      confirmationToken: pending.confirmationToken,
    });

    await expect(
      service.execute({
        user,
        confirm: true,
        confirmationToken: pending.confirmationToken,
      }),
    ).rejects.toThrow(ValidationError);
    expect(ran).toBe(1);
  });
});

describe('IntentRegistry', () => {
  it('rejects duplicate and forbidden intent names', () => {
    const registry = createIntentRegistry();
    registry.register(searchOrdersIntent());
    expect(() => registry.register(searchOrdersIntent())).toThrow(ValidationError);
    expect(() =>
      registry.register({
        ...searchOrdersIntent(),
        name: 'EXECUTE_SQL',
      }),
    ).toThrow(/arbitrary execution/i);
    expect(FORBIDDEN_INTENT_NAME.test('EXECUTE_SQL')).toBe(true);
  });

  it('lists descriptors so hackathons can add intents without rewriting the engine', () => {
    const registry = createDefaultIntentRegistry({ demoMode: true });
    const names = registry.names();
    expect(names).toEqual(
      expect.arrayContaining([
        'SEARCH_CUSTOMERS',
        'SEARCH_ORDERS',
        'GET_INVOICE',
        'GENERATE_REPORT',
        'SUMMARIZE_CUSTOMER',
        'CREATE_TASK',
        'DELETE_RECORD',
        'BULK_UPDATE_ORDERS',
        'SEND_CUSTOMER_MESSAGE',
        'APPLY_CREDIT',
      ]),
    );
    expect(registry.descriptors().find((item) => item.name === 'DELETE_RECORD')).toEqual(
      expect.objectContaining({ requiresConfirmation: true, highRiskClass: 'DELETE' }),
    );
  });
});
