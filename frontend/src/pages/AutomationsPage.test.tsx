import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '../auth/AuthProvider';
import { TEST_SESSION } from '../test/session';
import { AutomationsPage } from './AutomationsPage';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('AutomationsPage', () => {
  it('loads catalog, rules, and executions', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/automations/catalog')) {
        return jsonResponse({
          triggers: [{ name: 'invoice.overdue', description: 'Overdue invoice' }],
          operators: ['greaterThan'],
          actions: [{ type: 'sendNotification', description: 'Notify', destructive: false, requiredPermission: 'notifications.write' }],
        });
      }
      if (url.includes('/automations/executions')) {
        return jsonResponse({ items: [] });
      }
      return jsonResponse({
        items: [{ id: 'rule-1', name: 'Remind late invoices', trigger: 'invoice.overdue', enabled: true, priority: 100, conditions: [], actions: [], source: 'manual', allowDestructive: false, validatedAt: null, description: null }],
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AuthProvider initialSession={TEST_SESSION}>
        <AutomationsPage />
      </AuthProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Load rules' }));

    expect(await screen.findByText('Remind late invoices')).toBeInTheDocument();
    expect(screen.getByText(/Triggers: invoice.overdue/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create scheduled tick rule' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Disable' })).toBeInTheDocument();
  });
});

function jsonResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({ success: true, data, meta: {} }),
  } as Response;
}
