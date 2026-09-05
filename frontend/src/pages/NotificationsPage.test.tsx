import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '../auth/AuthProvider';
import { TEST_SESSION } from '../test/session';
import { NotificationsPage } from './NotificationsPage';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('NotificationsPage', () => {
  it('loads inbox and preferences', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/unread-count')) {
        return jsonResponse({ count: 1 });
      }
      if (url.includes('/preferences')) {
        return jsonResponse({
          categories: ['marketing'],
          channels: ['email'],
          mandatoryCategories: ['security_alerts'],
          preferences: [{ category: 'marketing', channel: 'email', enabled: true }],
        });
      }
      return jsonResponse({
        items: [{ id: 'n1', type: 'info', title: 'Welcome', body: 'Your account is ready', readAt: null }],
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AuthProvider initialSession={TEST_SESSION}>
        <NotificationsPage />
      </AuthProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Load inbox' }));

    expect(await screen.findByText('Welcome')).toBeInTheDocument();
    expect(screen.getByLabelText('marketing email')).toBeChecked();
  });
});

function jsonResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({ success: true, data, meta: {} }),
  } as Response;
}
