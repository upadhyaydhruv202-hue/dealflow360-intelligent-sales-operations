import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiClientError, createApiClient, getApiErrorMessage } from './api';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('api client', () => {
  it('returns envelope data and attaches a bearer token', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ success: true, data: { id: '1' }, meta: {} }));
    vi.stubGlobal('fetch', fetchMock);

    const client = createApiClient({ baseUrl: 'https://api.example' });
    const data = await client.get<{ id: string }>('/api/v1/items', {
      token: 'secret-token',
      query: { q: 'alpha' },
    });

    expect(data).toEqual({ id: '1' });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example/api/v1/items?q=alpha',
      expect.objectContaining({
        method: 'GET',
        credentials: 'include',
        headers: expect.objectContaining({ Authorization: 'Bearer secret-token' }),
      }),
    );
  });

  it('throws ApiClientError for unsuccessful envelopes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse(
          {
            success: false,
            error: { code: 'NOT_FOUND', message: 'Missing', details: {} },
            requestId: 'req-1',
          },
          404,
        ),
      ),
    );

    const client = createApiClient();
    await expect(client.get('/api/v1/missing')).rejects.toMatchObject({
      name: 'ApiClientError',
      message: 'Missing',
      statusCode: 404,
    });
    expect(getApiErrorMessage(new ApiClientError('Missing', 404))).toBe('Missing');
  });

  it('uses getToken when a request does not pass a token', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ success: true, data: {}, meta: {} }));
    const client = createApiClient({
      fetchImpl: fetchMock as unknown as typeof fetch,
      getToken: () => 'from-provider',
    });

    await client.post('/api/v1/jobs', { name: 'demo' });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/jobs',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        headers: expect.objectContaining({ Authorization: 'Bearer from-provider' }),
      }),
    );
  });

  it('maps non-JSON bodies to ApiClientError without leaking the payload', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 502,
        json: async () => {
          throw new SyntaxError('Unexpected token <');
        },
      })),
    );

    const client = createApiClient();
    await expect(client.get('/api/v1/jobs')).rejects.toMatchObject({
      name: 'ApiClientError',
      message: 'Request failed: 502',
      statusCode: 502,
    });
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}
