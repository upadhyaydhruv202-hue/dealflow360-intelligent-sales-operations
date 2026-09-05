import { afterEach, describe, expect, it, vi } from 'vitest';

import { register } from './auth';
import { getFile } from './files';
import { getJob } from './jobs';
import { generatePdf } from './pdf';
import { listReportTypes } from './reports';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('hackathon API clients', () => {
  it('calls register, job status, files, pdf, and reports endpoints', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/auth/register')) {
        return jsonResponse({
          success: true,
          data: {
            user: { id: 'u1', email: 'a@example.com', displayName: 'A', status: 'active', role: 'user', roles: ['user'], permissions: [] },
            tokens: { accessToken: 'a', refreshToken: 'r', tokenType: 'Bearer', expiresIn: 900 },
          },
          meta: {},
        });
      }
      if (url.includes('/jobs/')) {
        return jsonResponse({
          success: true,
          data: {
            jobId: 'job-1',
            type: 'demo',
            status: 'completed',
            attempts: 1,
            createdAt: '2026-01-01T00:00:00.000Z',
            startedAt: null,
            completedAt: null,
            error: null,
            progress: 100,
          },
          meta: {},
        });
      }
      if (url.includes('/files/')) {
        return jsonResponse({
          success: true,
          data: {
            id: 'f1',
            originalName: 'a.txt',
            storedName: 'a.txt',
            mimeType: 'text/plain',
            size: 1,
            provider: 'local',
            createdAt: '2026-01-01T00:00:00.000Z',
          },
          meta: {},
        });
      }
      if (url.includes('/pdf/generate')) {
        return jsonResponse({
          success: true,
          data: { queued: true, key: 'pdfs/1/a.pdf', filename: 'a.pdf', jobId: 'job-2' },
          meta: {},
        });
      }
      return jsonResponse({ success: true, data: { types: [{ type: 'table' }] }, meta: {} });
    });
    vi.stubGlobal('fetch', fetchMock);

    await register({ email: 'a@example.com', password: 'correct-horse', displayName: 'A' });
    await getJob('job-1', 'token');
    await getFile('f1', 'token');
    await generatePdf({ title: 'Demo' }, 'token');
    await listReportTypes('token');

    const urls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(urls.some((url) => url.includes('/api/v1/auth/register'))).toBe(true);
    expect(urls.some((url) => url.includes('/api/v1/jobs/job-1'))).toBe(true);
    expect(urls.some((url) => url.includes('/api/v1/files/f1'))).toBe(true);
    expect(urls.some((url) => url.includes('/api/v1/pdf/generate'))).toBe(true);
    expect(urls.some((url) => url.includes('/api/v1/reports/types'))).toBe(true);
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}
