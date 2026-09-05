import { describe, expect, it, vi } from 'vitest';

import {
  AuthenticationError,
  AuthorizationError,
  ExternalServiceError,
  ValidationError,
} from '../../errors';
import { AuditService, createMemoryAuditStore } from '../../audit';
import { AUDIT_ACTIONS } from '../../constants';
import { createJobQueue } from '../../jobs/queue';
import { PERMISSIONS } from '../../rbac/catalog';
import { createMemoryOdooCache } from './odoo.cache';
import {
  createOdooCapabilityRegistry,
  odooReadCapability,
  odooWriteCapability,
} from './odoo.capabilities';
import { createOdooModelAdapter } from './models';
import { actor, createTestService, jsonResponse } from './odoo.test-helpers';

describe('OdooService', () => {
  it('reports skipped connectivity when Odoo is disabled', async () => {
    const service = createTestService({
      runtime: {
        enabled: false,
        ready: false,
        timeoutMs: 250,
        maxRetries: 0,
        retryBaseMs: 0,
        userAgent: 'test',
        maxPageSize: 100,
        batchSize: 50,
      },
    });

    await expect(service.checkConnectivity()).resolves.toMatchObject({
      configured: false,
      skipped: true,
      healthy: true,
    });
    await expect(service.search({ model: 'res.partner', domain: [] })).rejects.toBeInstanceOf(
      ExternalServiceError,
    );
  });

  it('pings Odoo for a connectivity check', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { uid: 2, lang: 'en_US' }));
    const service = createTestService({ fetchImpl });

    await expect(service.checkConnectivity()).resolves.toMatchObject({
      configured: true,
      healthy: true,
      skipped: false,
    });
    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain('/json/2/res.users/context_get');
  });

  it('treats Odoo authentication failure as an unhealthy check', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(401, { message: 'Invalid apikey' }));
    const service = createTestService({ fetchImpl });
    const check = await service.checkConnectivity();

    expect(check.healthy).toBe(false);
    expect(check.error).toMatch(/authentication failed|Invalid apikey/i);
  });

  it('executes an allowlisted read for an authorized user', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(200, [{ id: 1, name: 'Deco Addict' }]),
    );
    const service = createTestService({
      fetchImpl,
      capabilities: createOdooCapabilityRegistry([odooReadCapability('partners.read', 'res.partner')]),
    });

    const records = await service.execute({
      user: actor([PERMISSIONS.ODOO_READ]),
      capability: 'partners.read',
      method: 'search_read',
      params: {
        domain: [['is_company', '=', true]],
        fields: ['name'],
      },
    });

    expect(records).toEqual([{ id: 1, name: 'Deco Addict' }]);
    expect(String(fetchImpl.mock.calls[0]?.[0])).toBe('https://odoo.example.com/json/2/res.partner/search_read');
  });

  it('rejects unauthorized application users even when Odoo would succeed', async () => {
    const fetchImpl = vi.fn();
    const service = createTestService({
      fetchImpl,
      capabilities: createOdooCapabilityRegistry([odooReadCapability('partners.read', 'res.partner')]),
    });

    await expect(
      service.execute({
        user: actor(['notifications.read']),
        capability: 'partners.read',
        method: 'search_read',
        params: { domain: [] },
      }),
    ).rejects.toBeInstanceOf(AuthorizationError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('never executes an arbitrary method name supplied by a caller', async () => {
    const fetchImpl = vi.fn();
    const service = createTestService({
      fetchImpl,
      capabilities: createOdooCapabilityRegistry([odooReadCapability('partners.read', 'res.partner')]),
    });

    await expect(
      service.execute({
        user: actor([PERMISSIONS.ODOO_READ]),
        capability: 'partners.read',
        method: 'unlink',
        ids: [1],
      }),
    ).rejects.toBeInstanceOf(AuthorizationError);

    await expect(
      service.execute({
        user: actor([PERMISSIONS.ODOO_READ]),
        capability: 'partners.read',
        method: '_execute',
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('requires confirmation for sensitive writes', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, true));
    const service = createTestService({
      fetchImpl,
      capabilities: createOdooCapabilityRegistry([odooWriteCapability('partners.write', 'res.partner')]),
    });
    const user = actor([PERMISSIONS.ODOO_WRITE]);

    await expect(
      service.execute({
        user,
        capability: 'partners.write',
        method: 'write',
        ids: [1],
        params: { values: { name: 'Updated' } },
      }),
    ).rejects.toBeInstanceOf(ValidationError);

    await expect(
      service.execute({
        user,
        capability: 'partners.write',
        method: 'write',
        ids: [1],
        params: { values: { name: 'Updated' } },
        confirmed: true,
      }),
    ).resolves.toBe(true);
  });

  it('rejects non-idempotent methods on odoo.sync', async () => {
    const jobs = createJobQueue();
    const service = createTestService({ jobs });
    await expect(
      service.enqueueSync({ capability: 'res.partner.read', method: 'unlink', ids: [1] }),
    ).rejects.toMatchObject({ name: 'UnretryableError' });
  });

  it('does not cache writes and only caches opted-in reads', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, [{ id: 1, name: 'A' }]))
      .mockResolvedValueOnce(jsonResponse(200, [{ id: 1, name: 'A' }]))
      .mockResolvedValueOnce(jsonResponse(200, true));
    const service = createTestService({
      fetchImpl,
      cache: createMemoryOdooCache(),
      capabilities: createOdooCapabilityRegistry([odooWriteCapability('partners.write', 'res.partner')]),
    });

    const first = await service.read(
      { model: 'res.partner', ids: [1], fields: ['name'] },
      { ttlMs: 10_000 },
    );
    const second = await service.read(
      { model: 'res.partner', ids: [1], fields: ['name'] },
      { ttlMs: 10_000 },
    );
    await service.write({
      model: 'res.partner',
      ids: [1],
      values: { name: 'B' },
      capability: 'partners.write',
      user: actor([PERMISSIONS.ODOO_WRITE]),
      confirmed: true,
    });

    expect(first).toEqual(second);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('audits Odoo writes with field names and without values', async () => {
    const store = createMemoryAuditStore();
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, true));
    const service = createTestService({
      fetchImpl,
      audit: new AuditService(store),
      capabilities: createOdooCapabilityRegistry([odooWriteCapability('partners.write', 'res.partner')]),
    });

    await service.write({
      model: 'res.partner',
      ids: [9],
      values: { name: 'Ada', new_password: 'should-not-be-stored' },
      capability: 'partners.write',
      user: actor([PERMISSIONS.ODOO_WRITE]),
      confirmed: true,
    });

    expect(store.events[0]).toMatchObject({
      action: AUDIT_ACTIONS.ODOO_RECORD_UPDATED,
      resource: 'res.partner',
      resourceId: '9',
      request: { model: 'res.partner', ids: [9], fields: expect.arrayContaining(['name', 'new_password']) },
    });
    expect(JSON.stringify(store.events)).not.toMatch(/should-not-be-stored/);
  });

  it('audits privileged Odoo method calls', async () => {
    const store = createMemoryAuditStore();
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, true));
    const service = createTestService({
      fetchImpl,
      audit: new AuditService(store),
      capabilities: createOdooCapabilityRegistry([
        odooWriteCapability('orders.confirm', 'sale.order', {
          methods: ['action_confirm'],
          requiresConfirmation: true,
        }),
      ]),
    });

    await service.callMethod({
      model: 'sale.order',
      method: 'action_confirm',
      ids: [12],
      capability: 'orders.confirm',
      user: actor([PERMISSIONS.ODOO_WRITE]),
      confirmed: true,
    });

    expect(store.events[0]).toMatchObject({
      action: AUDIT_ACTIONS.ODOO_METHOD_CALLED,
      resource: 'sale.order',
      resourceId: '12',
      request: { model: 'sale.order', ids: [12], method: 'action_confirm' },
    });
  });

  it('rejects privileged writes that skip the capability path', async () => {
    const fetchImpl = vi.fn();
    const service = createTestService({ fetchImpl });

    await expect(
      service.write({
        model: 'res.partner',
        ids: [1],
        values: { name: 'B' },
      } as never),
    ).rejects.toBeInstanceOf(AuthorizationError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects a write whose model does not match the capability', async () => {
    const fetchImpl = vi.fn();
    const service = createTestService({
      fetchImpl,
      capabilities: createOdooCapabilityRegistry([odooWriteCapability('partners.write', 'res.partner')]),
    });

    await expect(
      service.write({
        model: 'res.users',
        ids: [1],
        values: { name: 'Root' },
        capability: 'partners.write',
        user: actor([PERMISSIONS.ODOO_WRITE]),
        confirmed: true,
      }),
    ).rejects.toBeInstanceOf(AuthorizationError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('does not expose raw Odoo operations as a public backdoor', () => {
    const service = createTestService({ fetchImpl: vi.fn() });
    expect(() => {
      void service.operations;
    }).toThrow(AuthorizationError);
  });

  it('binds a model adapter to execute() rather than ungated operations', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, [{ id: 8, name: 'Ada' }]));
    const service = createTestService({
      fetchImpl,
      capabilities: createOdooCapabilityRegistry([odooReadCapability('partners.read', 'res.partner')]),
    });
    const partners = createOdooModelAdapter({
      model: 'res.partner',
      service,
      readCapability: 'partners.read',
    });

    await expect(
      partners.read({ ids: [8], fields: ['name'], user: actor([PERMISSIONS.ODOO_READ]) }),
    ).resolves.toEqual([{ id: 8, name: 'Ada' }]);
    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain('/res.partner/read');
  });

  it('surfaces Odoo authentication failures from trusted operations', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(401, { message: 'Invalid apikey' }));
    const service = createTestService({ fetchImpl });

    await expect(service.read({ model: 'res.partner', ids: [1] })).rejects.toBeInstanceOf(AuthenticationError);
  });
});
