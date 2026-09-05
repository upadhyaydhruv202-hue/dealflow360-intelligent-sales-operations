import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '../auth/AuthProvider';
import { TEST_SESSION } from '../test/session';
import { SearchPage } from './SearchPage';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('SearchPage', () => {
  it('loads indexes and searches demo documents', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/v1/search/indexes')) {
        return jsonResponse({
          provider: 'memory',
          indexes: [{ name: 'kit.demo', ownerScoped: false, httpWritable: true, filterableFields: ['status'], sortableFields: ['title'] }],
        });
      }
      if (url.includes('/api/v1/search') && init?.method === 'POST') {
        expect(JSON.parse(String(init.body))).toMatchObject({ query: 'refund' });
        return jsonResponse(
          {
            provider: 'memory',
            mode: 'keyword',
            query: 'refund',
            indexes: ['kit.demo'],
            hits: [
              {
                index: 'kit.demo',
                documentId: 'refund-policy',
                title: 'Refund policy for late shipments',
                snippet: 'Customers may request a refund within 14 days.',
                score: 1,
                fields: { status: 'published' },
              },
            ],
            pagination: {
              page: 1,
              pageSize: 10,
              totalItems: 1,
              totalPages: 1,
              hasNextPage: false,
              hasPreviousPage: false,
            },
          },
          200,
          {
            page: 1,
            pageSize: 10,
            totalItems: 1,
            totalPages: 1,
            hasNextPage: false,
            hasPreviousPage: false,
          },
        );
      }
      return jsonResponse({});
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider initialSession={TEST_SESSION}>
          <SearchPage />
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText(/1 index available/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect(await screen.findByText('Refund policy for late shipments')).toBeInTheDocument();
    expect(screen.getByText(/kit.demo \/ refund-policy/)).toBeInTheDocument();
  });
});

function jsonResponse(data: unknown, status = 200, meta: Record<string, unknown> = {}): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({ success: true, data, meta }),
  } as Response;
}
