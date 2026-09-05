import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '../auth/AuthProvider';
import { TEST_SESSION } from '../test/session';
import { AnalyticsPage } from './AnalyticsPage';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('AnalyticsPage', () => {
  it('loads KPIs and runs a demo time-series query', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/v1/analytics/kpis')) {
        return jsonResponse({
          provider: 'memory',
          kpis: [
            {
              name: 'kit.demo.events',
              aggregation: 'count',
              ownerScoped: false,
              httpWritable: true,
              filterableFields: ['status'],
              groupableFields: ['status'],
            },
          ],
        });
      }
      if (url.includes('/api/v1/analytics/query') && init?.method === 'POST') {
        expect(JSON.parse(String(init.body))).toMatchObject({ kpi: 'kit.demo.events', kind: 'timeseries' });
        return jsonResponse(
          {
            provider: 'memory',
            kind: 'timeseries',
            kpi: 'kit.demo.events',
            aggregation: 'count',
            from: '2026-08-28T00:00:00.000Z',
            to: '2026-09-04T00:00:00.000Z',
            granularity: 'day',
            points: [{ bucket: '2026-09-01T00:00:00.000Z', value: 3, samples: 3 }],
            pagination: {
              page: 1,
              pageSize: 20,
              totalItems: 1,
              totalPages: 1,
              hasNextPage: false,
              hasPreviousPage: false,
            },
          },
          200,
          {
            page: 1,
            pageSize: 20,
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
          <AnalyticsPage />
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText(/1 KPI available/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Run query' }));
    expect(await screen.findByRole('img', { name: 'Time series' })).toBeInTheDocument();
  });
});

function jsonResponse(data: unknown, status = 200, meta: Record<string, unknown> = {}): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({ success: true, data, meta }),
  } as Response;
}
