import { describe, expect, it } from 'vitest';

import { AUDIT_ACTIONS } from '../constants';
import { AuditService, createMemoryAuditStore } from './audit.service';
import { redactAuditValue } from './audit.redact';
import { runWithRequestContext } from '../utils/request-context';

describe('AuditService', () => {
  it('records an event with request context and redacts secrets', async () => {
    const store = createMemoryAuditStore();
    const audit = new AuditService(store);

    await runWithRequestContext({ requestId: 'req-1', ip: '203.0.113.8', actorId: undefined }, async () => {
      await audit.record({
        actorId: '11111111-1111-4111-8111-111111111111',
        action: AUDIT_ACTIONS.USER_LOGIN,
        resource: 'user',
        resourceId: '11111111-1111-4111-8111-111111111111',
        metadata: { password: 'hunter2', note: 'ok' },
        oldValue: { token: 'secret-token' },
        newValue: { accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.aaaa.bbbb' },
      });
    });

    expect(store.events).toHaveLength(1);
    const event = store.events[0];
    expect(event).toMatchObject({
      action: AUDIT_ACTIONS.USER_LOGIN,
      resource: 'user',
      requestId: 'req-1',
      ip: '203.0.113.8',
      status: 'succeeded',
    });
    expect(event?.request).toEqual({ password: '[Redacted]', note: 'ok' });
    expect(event?.oldValue).toEqual({ token: '[Redacted]' });
    expect(JSON.stringify(event)).not.toMatch(/hunter2|secret-token|eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9/);
  });

  it('does not throw when the store fails', async () => {
    const audit = new AuditService({
      async record() {
        throw new Error('audit store down');
      },
      async list() {
        throw new Error('audit store down');
      },
    });

    await expect(
      audit.record({ action: AUDIT_ACTIONS.FILE_UPLOADED, resource: 'file' }),
    ).resolves.toBeUndefined();
  });

  it('paginates and filters by actor, action, and date range', async () => {
    const store = createMemoryAuditStore();
    const audit = new AuditService(store);
    const actorA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const actorB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

    await audit.record({ actorId: actorA, action: AUDIT_ACTIONS.USER_CREATED, resource: 'user' });
    await audit.record({ actorId: actorA, action: AUDIT_ACTIONS.USER_LOGIN, resource: 'user' });
    await audit.record({ actorId: actorB, action: AUDIT_ACTIONS.USER_LOGIN, resource: 'user' });

    const page = await audit.list({ page: 1, pageSize: 1, action: AUDIT_ACTIONS.USER_LOGIN });
    expect(page.items).toHaveLength(1);
    expect(page.meta).toMatchObject({ page: 1, pageSize: 1, totalItems: 2, hasNextPage: true });

    const byActor = await audit.list({ actorId: actorA, action: AUDIT_ACTIONS.USER_LOGIN });
    expect(byActor.items).toHaveLength(1);
    expect(byActor.items[0]?.actorId).toBe(actorA);

    const future = await audit.list({ from: new Date(Date.now() + 60_000) });
    expect(future.items).toHaveLength(0);
  });
  it('drops non-UUID actor ids so they cannot break the user foreign key', async () => {
    const store = createMemoryAuditStore();
    const audit = new AuditService(store);

    await audit.record({
      actorId: 'system',
      action: AUDIT_ACTIONS.FILE_UPLOADED,
      resource: 'file',
    });

    expect(store.events[0]?.actorId).toBeUndefined();
    expect(store.events[0]?.userId).toBeUndefined();
  });
});

describe('audit redaction', () => {
  it('redacts JWTs, API keys, and OTP fields', () => {
    const redacted = redactAuditValue({
      authorization: 'Bearer abc',
      apiKey: 'sk-live-secret',
      otp: '123456',
      jwt: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.sig',
      safe: 'visible',
    });

    expect(redacted).toEqual({
      authorization: '[Redacted]',
      apiKey: '[Redacted]',
      otp: '[Redacted]',
      jwt: '[Redacted]',
      safe: 'visible',
    });
  });

  it('redacts password-like keys such as new_password without treating timeout as a token', () => {
    expect(
      redactAuditValue({
        new_password: 'secret-value',
        smtpPassword: 'smtp-secret',
        timeout: 30,
      }),
    ).toEqual({
      new_password: '[Redacted]',
      smtpPassword: '[Redacted]',
      timeout: 30,
    });
  });

  it('redacts compound API-key header names without treating timeout as a token', () => {
    expect(
      redactAuditValue({
        'x-api-key': 'sk-live-secret',
        access_key: 'AKIAEXAMPLE',
        timeoutMs: 250,
      }),
    ).toEqual({
      'x-api-key': '[Redacted]',
      access_key: '[Redacted]',
      timeoutMs: 250,
    });
  });
});
