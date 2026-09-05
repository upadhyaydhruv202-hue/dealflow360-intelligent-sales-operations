import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { FeatureProvider } from '../features';
import { HomePage } from './HomePage';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('HomePage', () => {
  it('renders foundation status from health endpoints', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith('/health')) {
        return jsonResponse({
          success: true,
          data: {
            status: 'ok',
            service: 'Hackathon Starter Kit',
            environment: 'test',
            uptimeSeconds: 1,
            timestamp: new Date().toISOString(),
          },
          meta: {},
        });
      }

      if (url.includes('/api/v1/features')) {
        return jsonResponse({
          success: true,
          data: {
            demoMode: true,
            features: { ai: true, copilot: true },
          },
          meta: {},
        });
      }

      return jsonResponse({
        success: true,
        data: {
          status: 'ready',
          checks: {
            database: { configured: false, healthy: true, skipped: true },
            redis: { configured: false, healthy: true, skipped: true },
            odoo: { configured: false, healthy: true, skipped: true },
            ai: { configured: false, healthy: true, skipped: true },
          },
        },
        meta: {},
      });
    });

    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <FeatureProvider>
          <HomePage />
        </FeatureProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText(/Foundation is running/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('ok')).toBeInTheDocument();
      expect(screen.getByText('ready')).toBeInTheDocument();
      expect(screen.getByText('Demo mode')).toBeInTheDocument();
    });
  });
});

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as Response;
}
