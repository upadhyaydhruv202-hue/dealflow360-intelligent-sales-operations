import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '../auth/AuthProvider';
import { TEST_SESSION } from '../test/session';
import { AnomalyPage } from './AnomalyPage';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('AnomalyPage', () => {
  it('evaluates a series and keeps evidence separate from explanation', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/api/v1/anomalies/evaluate')) {
        expect(init?.method).toBe('POST');
        const body = JSON.parse(String(init?.body)) as { metric: string; points: number[] };
        expect(body.metric).toBe('sales');
        expect(body.points.length).toBeGreaterThan(2);
        return jsonResponse({
          id: '11111111-1111-1111-1111-111111111111',
          metric: 'sales',
          anomaly: true,
          severity: 'HIGH',
          change: -23.4,
          evidence: {
            sampleSize: 10,
            latest: 76.6,
            baseline: 100,
            change: -23.4,
            fired: ['percentChange', 'zScore'],
            skipped: [],
            sufficientSample: true,
            claimsStatisticalSignificance: false,
            insufficientData: false,
          },
          explanation: 'Sales dropped 23.4% versus the recent baseline.',
          recommendedAction: 'Confirm the source data, then review operations in the same window.',
          explanationStatus: 'generated',
        });
      }
      return jsonResponse({});
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider initialSession={TEST_SESSION}>
          <AnomalyPage />
        </AuthProvider>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Evaluate series' }));
    expect(await screen.findByText('Sales dropped 23.4% versus the recent baseline.')).toBeInTheDocument();
    expect(screen.getByText('HIGH')).toBeInTheDocument();
    expect(screen.getByText(/change -23.4%/)).toBeInTheDocument();
    expect(screen.getByText(/statistical significance claimed: no/i)).toBeInTheDocument();
  });
});

function jsonResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({ success: true, data, meta: {} }),
  } as Response;
}
