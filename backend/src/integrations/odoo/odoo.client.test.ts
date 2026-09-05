import { describe, expect, it, vi } from 'vitest';

import {
  AuthenticationError,
  AuthorizationError,
  ExternalServiceError,
  NotFoundError,
  RateLimitError,
  TimeoutError,
  ValidationError,
} from '../../errors';
import { OdooOperations } from './odoo.operations';
import { createTestClient, jsonResponse, odooRuntime } from './odoo.test-helpers';

function captureFetch() {
  const fetchImpl = vi.fn();
  return fetchImpl;
}

describe('OdooClient', () => {
  it('reads records through the JSON-2 endpoint with bearer auth', async () => {
    const fetchImpl = captureFetch();
    fetchImpl.mockResolvedValueOnce(
      jsonResponse(200, [
        { id: 7, name: 'Deco Addict' },
      ]),
    );

    const client = createTestClient(fetchImpl);
    const records = await client.call({
      model: 'res.partner',
      method: 'read',
      body: { ids: [7], fields: ['name'] },
    });

    expect(records).toEqual([{ id: 7, name: 'Deco Addict' }]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://odoo.example.com/json/2/res.partner/read');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe('bearer secret-api-key');
    expect((init.headers as Record<string, string>)['X-Odoo-Database']).toBe('company');
    expect(JSON.parse(String(init.body))).toEqual({ ids: [7], fields: ['name'] });
  });

  it('maps Odoo 401 authentication failures without leaking the traceback', async () => {
    const fetchImpl = captureFetch();
    fetchImpl.mockResolvedValueOnce(
      jsonResponse(401, {
        name: 'werkzeug.exceptions.Unauthorized',
        message: 'Invalid apikey',
        debug: 'Traceback (most recent call last):\n  File "/opt/Odoo/http.py"',
      }),
    );

    const error = await createTestClient(fetchImpl)
      .call({ model: 'res.partner', method: 'read', body: { ids: [1] } })
      .then(
        () => {
          throw new Error('expected failure');
        },
        (reason: unknown) => reason,
      );

    expect(error).toBeInstanceOf(AuthenticationError);
    expect(error).toMatchObject({ statusCode: 401, message: 'Invalid apikey' });
    expect(JSON.stringify(error)).not.toContain('/opt/Odoo');
    expect(JSON.stringify(error)).not.toContain('Traceback');
  });

  it('maps Odoo 403 permission failures', async () => {
    const fetchImpl = captureFetch();
    fetchImpl.mockResolvedValueOnce(jsonResponse(403, { name: 'odoo.exceptions.AccessError', message: 'Access denied' }));

    await expect(
      createTestClient(fetchImpl).call({ model: 'res.partner', method: 'write', body: { ids: [1], vals: { name: 'x' } } }),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it('maps Odoo 404, 429, 5xx, and validation errors', async () => {
    const fetchImpl = captureFetch();
    fetchImpl
      .mockResolvedValueOnce(jsonResponse(404, { message: 'Model not found' }))
      .mockResolvedValueOnce(jsonResponse(429, { message: 'Too many requests' }, { 'retry-after': '0' }))
      .mockResolvedValueOnce(jsonResponse(500, { message: 'Internal Server Error', debug: 'Traceback' }))
      .mockResolvedValueOnce(jsonResponse(400, { name: 'odoo.exceptions.ValidationError', message: 'Missing name' }));

    const client = createTestClient(fetchImpl, odooRuntime({ maxRetries: 0 }));

    await expect(client.call({ model: 'res.partner', method: 'read', body: { ids: [9] } })).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(client.call({ model: 'res.partner', method: 'read', body: { ids: [9] } })).rejects.toBeInstanceOf(
      RateLimitError,
    );
    await expect(client.call({ model: 'res.partner', method: 'read', body: { ids: [9] } })).rejects.toBeInstanceOf(
      ExternalServiceError,
    );
    await expect(client.call({ model: 'res.partner', method: 'read', body: { ids: [9] } })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it('does not expose Odoo debug traces on 5xx failures', async () => {
    const fetchImpl = captureFetch();
    fetchImpl.mockResolvedValueOnce(
      jsonResponse(500, { message: 'boom', debug: 'Traceback at /opt/Odoo/addons/secret.py' }),
    );

    try {
      await createTestClient(fetchImpl, odooRuntime({ maxRetries: 0 })).call({
        model: 'res.partner',
        method: 'read',
        body: { ids: [1] },
      });
      throw new Error('expected failure');
    } catch (error) {
      expect(error).toBeInstanceOf(ExternalServiceError);
      expect(JSON.stringify(error)).not.toContain('Traceback');
      expect(JSON.stringify(error)).not.toContain('/opt/Odoo');
    }
  });

  it('maps timeouts', async () => {
    const fetchImpl = captureFetch();
    fetchImpl.mockImplementationOnce(async () => {
      const error = new Error('aborted');
      error.name = 'TimeoutError';
      throw error;
    });

    await expect(
      createTestClient(fetchImpl, odooRuntime({ maxRetries: 0 })).call({
        model: 'res.partner',
        method: 'read',
        body: { ids: [1] },
      }),
    ).rejects.toBeInstanceOf(TimeoutError);
  });

  it('retries safe transient failures on reads', async () => {
    const fetchImpl = captureFetch();
    fetchImpl
      .mockResolvedValueOnce(jsonResponse(503, { message: 'unavailable' }))
      .mockResolvedValueOnce(jsonResponse(200, [3]));

    const ids = await createTestClient(fetchImpl).call<number[]>({
      model: 'res.partner',
      method: 'search',
      body: { domain: [] },
      idempotent: true,
    });

    expect(ids).toEqual([3]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('does not retry unsafe writes on 5xx', async () => {
    const fetchImpl = captureFetch();
    fetchImpl.mockResolvedValue(jsonResponse(503, { message: 'unavailable' }));

    await expect(
      createTestClient(fetchImpl).call({
        model: 'res.partner',
        method: 'create',
        body: { vals_list: [{ name: 'Ada' }] },
        idempotent: false,
      }),
    ).rejects.toBeInstanceOf(ExternalServiceError);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe('OdooOperations', () => {
  it('paginates search_read with a hasNext probe', async () => {
    const fetchImpl = captureFetch();
    fetchImpl.mockResolvedValueOnce(
      jsonResponse(200, [
        { id: 1, name: 'A' },
        { id: 2, name: 'B' },
        { id: 3, name: 'C' },
      ]),
    );

    const page = await new OdooOperations(createTestClient(fetchImpl)).searchReadPaged({
      model: 'res.partner',
      fields: ['name'],
      page: 1,
      pageSize: 2,
    });

    expect(page).toEqual({
      page: 1,
      pageSize: 2,
      records: [
        { id: 1, name: 'A' },
        { id: 2, name: 'B' },
      ],
      hasNext: true,
      total: undefined,
    });
    expect(JSON.parse(String((fetchImpl.mock.calls[0] as [string, RequestInit])[1].body))).toMatchObject({
      limit: 3,
      offset: 0,
    });
  });

  it('rejects invalid search arguments before calling Odoo', async () => {
    const fetchImpl = captureFetch();
    const operations = new OdooOperations(createTestClient(fetchImpl));

    await expect(
      operations.search({
        model: 'Res.Partner',
        domain: [],
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('creates records through a mocked write', async () => {
    const fetchImpl = captureFetch();
    fetchImpl.mockResolvedValueOnce(jsonResponse(200, [42]));

    const ids = await new OdooOperations(createTestClient(fetchImpl)).create({
      model: 'res.partner',
      values: [{ name: 'Ada Lovelace' }],
    });

    expect(ids).toEqual([42]);
    expect(JSON.parse(String((fetchImpl.mock.calls[0] as [string, RequestInit])[1].body))).toEqual({
      vals_list: [{ name: 'Ada Lovelace' }],
    });
  });

  it('batches reads', async () => {
    const fetchImpl = captureFetch();
    fetchImpl
      .mockResolvedValueOnce(jsonResponse(200, [{ id: 1 }, { id: 2 }]))
      .mockResolvedValueOnce(jsonResponse(200, [{ id: 3 }]));

    const records = await new OdooOperations(createTestClient(fetchImpl)).readBatched(
      {
        model: 'res.partner',
        ids: [1, 2, 3],
        fields: ['name'],
      },
      { chunkSize: 2 },
    );

    expect(records.map((row) => row.id)).toEqual([1, 2, 3]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
