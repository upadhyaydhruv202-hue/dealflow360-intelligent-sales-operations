import {
  API_PATHS,
  ERROR_CODES,
  FEATURE_NAMES,
  createErrorEnvelope,
  createSuccessEnvelope,
  unknownSuccessResponseSchema,
} from '@hackathon/api-contract';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { FEATURE_NAMES as FRONTEND_FEATURE_NAMES } from '../features/flags';
import { ApiClientError, createApiClient } from './api';
import { register } from './auth';
import { getFile } from './files';
import { getJob } from './jobs';
import { generatePdf } from './pdf';
import { listReportTypes } from './reports';
import { getFeatures } from './features';
import { getHealth } from './health';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('frontend contract compatibility', () => {
  it('uses the shared FEATURE_NAMES list', () => {
    expect([...FRONTEND_FEATURE_NAMES]).toEqual([...FEATURE_NAMES]);
  });

  it('unwraps a contract-valid success envelope and throws on a contract-valid error', async () => {
    const success = createSuccessEnvelope({ id: '1' });
    expect(unknownSuccessResponseSchema.parse(success)).toEqual(success);

    const client = createApiClient({
      fetchImpl: (async () => jsonResponse(success)) as typeof fetch,
    });
    await expect(client.get<{ id: string }>(API_PATHS.jobs.byId('1'))).resolves.toEqual({ id: '1' });

    const failure = createErrorEnvelope({
      code: ERROR_CODES.NOT_FOUND,
      message: 'Missing',
      details: {},
      requestId: 'req-1',
    });
    const failing = createApiClient({
      fetchImpl: (async () => jsonResponse(failure, 404)) as typeof fetch,
    });
    await expect(failing.get(API_PATHS.jobs.byId('missing'))).rejects.toBeInstanceOf(ApiClientError);
  });

  it('calls the same /api/v1 paths the backend contract publishes', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL) => jsonResponse(createSuccessEnvelope({})));
    vi.stubGlobal('fetch', fetchMock);

    await register({ email: 'a@example.com', password: 'correct-horse', displayName: 'A' });
    await getJob('job-1', 'token');
    await getFile('f1', 'token');
    await generatePdf({ title: 'Demo' }, 'token');
    await listReportTypes('token');
    await getFeatures();
    await getHealth();

    const urls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(urls).toEqual(
      expect.arrayContaining([
        API_PATHS.auth.register,
        API_PATHS.jobs.byId('job-1'),
        API_PATHS.files.byId('f1'),
        API_PATHS.pdf.generate,
        API_PATHS.reports.types,
        API_PATHS.features,
        '/health',
      ]),
    );
    expect(API_PATHS.auth.register).toBe('/api/v1/auth/register');
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}
