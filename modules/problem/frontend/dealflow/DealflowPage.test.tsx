import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '@/auth/AuthProvider';
import { ApiClientProvider, createApiClient } from '@/services/api';
import { ThemeProvider, ToastProvider } from '@/ui';

import { DealflowDashboardPage } from './DashboardPage';
import { CustomerPortalPage } from './PortalPage';
import { QuoteWorkspacePage } from './QuoteWorkspacePage';
import { CUSTOMER_SESSION, SAMPLE_QUOTE, STAFF_SESSION } from './test-fixtures';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as Response;
}

function renderDealflow(ui: React.ReactElement, fetchMock: typeof fetch, path = '/dealflow') {
  return render(
    <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider initialSession={STAFF_SESSION}>
            <ApiClientProvider client={createApiClient({ fetchImpl: fetchMock })}>{ui}</ApiClientProvider>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </MemoryRouter>,
  );
}

describe('DealFlow360 frontend', () => {
  it('renders live dashboard KPIs from quote data', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/catalog')) {
        return jsonResponse({ success: true, data: { customers: [], products: [], warehouses: [], stock: [], policies: [], chains: [] }, meta: {} });
      }
      return jsonResponse({ success: true, data: [SAMPLE_QUOTE], meta: {} });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderDealflow(<DealflowDashboardPage />, fetchMock as unknown as typeof fetch);

    await waitFor(() => {
      expect(screen.getByText('Sales dashboard')).toBeInTheDocument();
    });
    expect(screen.getByText('Pending approvals')).toBeInTheDocument();
    expect(screen.getByText('DF-00002 · Northwind Retail')).toBeInTheDocument();
  });

  it('redirects a customer account away from the internal dashboard', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ success: true, data: [SAMPLE_QUOTE], meta: {} }));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter initialEntries={['/dealflow']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ThemeProvider>
          <ToastProvider>
            <AuthProvider initialSession={CUSTOMER_SESSION}>
              <ApiClientProvider client={createApiClient({ fetchImpl: fetchMock as unknown as typeof fetch })}>
                <Routes>
                  <Route path="/dealflow" element={<DealflowDashboardPage />} />
                  <Route path="/account" element={<p>Customer home</p>} />
                </Routes>
              </ApiClientProvider>
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Customer home')).toBeInTheDocument();
    expect(screen.queryByText('You do not have access')).not.toBeInTheDocument();
    expect(screen.queryByText('Sales dashboard')).not.toBeInTheDocument();
  });

  it('shows backend risk explanation in the quote workspace', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/recommendations')) {
        return jsonResponse({ success: true, data: [], meta: {} });
      }
      if (url.includes('/catalog')) {
        return jsonResponse({
          success: true,
          data: {
            customers: [SAMPLE_QUOTE.customer],
            products: [SAMPLE_QUOTE.lines[0].product],
            warehouses: [],
            stock: [],
            policies: [
              {
                id: 'ccccccc1-cccc-4ccc-8ccc-ccccccccccc4',
                name: 'Default ceiling',
                warningPercent: 3,
                approvalPercent: 5,
                rejectPercent: 25,
                maxMarginImpactPercent: 40,
                priority: 100,
              },
            ],
            chains: [],
          },
          meta: {},
        });
      }
      return jsonResponse({ success: true, data: SAMPLE_QUOTE, meta: {} });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter initialEntries={[`/dealflow/quotes/${SAMPLE_QUOTE.id}`]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ThemeProvider>
          <ToastProvider>
            <AuthProvider initialSession={STAFF_SESSION}>
              <ApiClientProvider client={createApiClient({ fetchImpl: fetchMock as unknown as typeof fetch })}>
                <Routes>
                  <Route path="/dealflow/quotes/:quoteId" element={<QuoteWorkspacePage />} />
                </Routes>
              </ApiClientProvider>
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /DF-00002 · Northwind Retail/ })).toBeInTheDocument();
    });
    expect(screen.getByText(/Sales Manager → Finance → Final/)).toBeInTheDocument();
    expect(screen.getByText(/Requested 16% exceeds approval ceiling 5%/)).toBeInTheDocument();
    expect(screen.getByText(/Waiting on Sales Manager/)).toBeInTheDocument();
  });

  it('keeps the customer portal free of internal approval controls', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ success: true, data: SAMPLE_QUOTE, meta: {} }));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter initialEntries={[`/portal/${SAMPLE_QUOTE.portalToken}`]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ThemeProvider>
          <ToastProvider>
            <ApiClientProvider client={createApiClient({ fetchImpl: fetchMock as unknown as typeof fetch })}>
              <Routes>
                <Route path="/portal/:token" element={<CustomerPortalPage />} />
              </Routes>
            </ApiClientProvider>
          </ToastProvider>
        </ThemeProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Your quotation')).toBeInTheDocument();
    });
    expect(screen.getByText('Northwind Retail · Status approval required')).toBeInTheDocument();
    expect(screen.queryByText('Approval center')).not.toBeInTheDocument();
    expect(screen.queryByText('Copy customer portal link')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Approve/ })).not.toBeInTheDocument();
  });
});
