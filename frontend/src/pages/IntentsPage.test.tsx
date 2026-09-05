import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '../auth/AuthProvider';
import { TEST_SESSION } from '../test/session';
import { IntentsPage } from './IntentsPage';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('IntentsPage', () => {
  it('loads the catalog and runs a natural-language action', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/api/v1/intents') && (!init?.method || init.method === 'GET')) {
        return jsonResponse({
          intents: [
            {
              name: 'SEARCH_ORDERS',
              description: 'Search demo orders',
              arguments: { status: 'pending|processing|delivered?' },
              requiredPermission: 'intents.use',
              riskLevel: 'low',
              requiresConfirmation: false,
              examples: ['Show pending orders'],
            },
          ],
        });
      }
      return jsonResponse({
        status: 'completed',
        command: {
          intent: 'SEARCH_ORDERS',
          input: { status: 'pending', amountGreaterThan: 50_000, dateRange: 'current_month' },
        },
        confidence: 0.91,
        result: { items: [{ id: 'ord-5004', total: 62_500 }] },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AuthProvider initialSession={TEST_SESSION}>
        <IntentsPage />
      </AuthProvider>,
    );

    expect(await screen.findByText('SEARCH_ORDERS')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Run action' }));
    expect(await screen.findByText(/SEARCH_ORDERS/)).toBeInTheDocument();
    expect(await screen.findByText(/ord-5004/)).toBeInTheDocument();
  });

  it('confirms a high-risk action using the server-issued token', async () => {
    const token = '11111111-1111-4111-8111-111111111111';
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/api/v1/intents') && (!init?.method || init.method === 'GET')) {
        return jsonResponse({
          intents: [
            {
              name: 'DELETE_RECORD',
              description: 'Delete a demo record',
              arguments: { id: 'string' },
              requiredPermission: 'intents.use',
              riskLevel: 'high',
              highRiskClass: 'DELETE',
              requiresConfirmation: true,
              examples: ['Delete order ord-5003'],
            },
          ],
        });
      }
      const body = JSON.parse(String(init?.body ?? '{}')) as {
        confirm?: boolean;
        confirmationToken?: string;
      };
      if (body.confirm) {
        expect(body.confirmationToken).toBe(token);
        return jsonResponse({
          status: 'completed',
          command: { intent: 'DELETE_RECORD', input: { id: 'ord-5003' } },
          result: { id: 'ord-5003', deleted: true },
        });
      }
      return jsonResponse({
        status: 'pending_confirmation',
        confirmationToken: token,
        highRiskClass: 'DELETE',
        command: { intent: 'DELETE_RECORD', input: { id: 'ord-5003' } },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AuthProvider initialSession={TEST_SESSION}>
        <IntentsPage />
      </AuthProvider>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Run action' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm action' }));
    expect(await screen.findByText(/deleted/)).toBeInTheDocument();
  });
});

function jsonResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({ success: true, data, meta: {} }),
  } as Response;
}
