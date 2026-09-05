import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '../auth/AuthProvider';
import { FeatureProvider } from '../features';
import { TEST_SESSION } from '../test/session';
import { RealtimePage } from './RealtimePage';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('RealtimePage', () => {
  it('loads allowlisted channels', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/v1/features')) {
        return jsonResponse({ demoMode: true, features: { realtime: true } });
      }
      if (url.includes('/api/v1/realtime/channels')) {
        return jsonResponse({
          channels: [
            { name: 'jobs', description: 'Jobs', permission: 'jobs.read' },
            { name: 'notifications', description: 'Inbox', permission: 'notifications.read' },
          ],
        });
      }
      if (url.includes('/api/v1/realtime/events')) {
        await new Promise<never>((_resolve, reject) => {
          const abort = () => reject(new DOMException('Aborted', 'AbortError'));
          if (init?.signal?.aborted) {
            abort();
            return;
          }
          init?.signal?.addEventListener('abort', abort, { once: true });
        });
      }
      return jsonResponse({});
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AuthProvider initialSession={TEST_SESSION}>
        <FeatureProvider>
          <RealtimePage />
        </FeatureProvider>
      </AuthProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Load allowed channels' }));
    expect(await screen.findByText('jobs')).toBeInTheDocument();
    expect(screen.getByText('notifications')).toBeInTheDocument();
  });
});

function jsonResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({ success: true, data, meta: {} }),
  } as Response;
}
