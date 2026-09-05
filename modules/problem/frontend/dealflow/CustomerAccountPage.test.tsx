import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '@/auth/AuthProvider';
import { ThemeProvider } from '@/ui';

import { CustomerAccountPage } from './CustomerAccountPage';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('CustomerAccountPage', () => {
  it('lists portal-safe quotations for the signed-in customer', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).includes('/dealflow/me/quotes')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              data: [
                {
                  id: 'q1',
                  number: 'DF-00001',
                  status: 'draft',
                  listTotal: 1000,
                  discountTotal: 0,
                  netTotal: 1000,
                  blendedDiscountPercent: 0,
                  version: 1,
                  portalToken: 'portal-token-1',
                  customer: { name: 'Northwind Retail' },
                  lines: [],
                },
              ],
              meta: {},
            }),
          } as Response;
        }
        return { ok: false, status: 404, json: async () => ({ success: false }) } as Response;
      }),
    );

    render(
      <MemoryRouter>
        <ThemeProvider>
          <AuthProvider
            initialSession={{
              user: {
                id: 'user-2',
                email: 'demo.user@example.com',
                displayName: 'Demo User',
                status: 'active',
                role: 'user',
                roles: ['user'],
                permissions: [],
              },
              accessToken: 'customer-token',
            }}
          >
            <CustomerAccountPage />
          </AuthProvider>
        </ThemeProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText('DF-00001 · Northwind Retail')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open portal' })).toHaveAttribute('href', '/portal/portal-token-1');
    expect(screen.queryByText('riskScore')).not.toBeInTheDocument();
  });
});
