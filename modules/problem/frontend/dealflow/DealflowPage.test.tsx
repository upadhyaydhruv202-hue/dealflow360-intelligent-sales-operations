import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '@/auth/AuthProvider';
import { ApiClientProvider, createApiClient } from '@/services/api';
import { ThemeProvider, ToastProvider } from '@/ui';

import { AnomalyCenterPage } from './AnomalyCenterPage';
import { ApprovalDetailPage } from './ApprovalDetailPage';
import { AssistantPage } from './AssistantPage';
import { ProductDetailPage } from './CatalogDetailPages';
import { DealflowDashboardPage } from './DashboardPage';
import { CustomerPortalPage } from './PortalPage';
import { QuoteWorkspacePage } from './QuoteWorkspacePage';
import { QuotesListPage } from './QuotesListPage';
import { SettingsPage } from './SettingsPage';
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
      if (url.includes('/anomalies')) {
        return jsonResponse({ success: true, data: [], meta: {} });
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

  it('sends a signed-out visitor to the dedicated login page', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ success: true, data: [], meta: {} }));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter initialEntries={['/dealflow']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ThemeProvider>
          <ToastProvider>
            <AuthProvider>
              <ApiClientProvider client={createApiClient({ fetchImpl: fetchMock as unknown as typeof fetch })}>
                <Routes>
                  <Route path="/dealflow" element={<DealflowDashboardPage />} />
                  <Route path="/login" element={<p>Sales operations sign-in</p>} />
                </Routes>
              </ApiClientProvider>
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Sales operations sign-in')).toBeInTheDocument();
    expect(screen.queryByText('Sign in to DealFlow360')).not.toBeInTheDocument();
    expect(screen.queryByText('Sales dashboard')).not.toBeInTheDocument();
  });

  it('keeps a staff deep link while the session cookie is restoring', async () => {
    let resolveRefresh: ((value: Response) => void) | undefined;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/auth/refresh')) {
        return new Promise<Response>((resolve) => {
          resolveRefresh = resolve;
        });
      }
      if (url.includes('/catalog')) {
        return jsonResponse({
          success: true,
          data: { customers: [], products: [], warehouses: [], stock: [], policies: [], chains: [] },
          meta: {},
        });
      }
      return jsonResponse({ success: true, data: [SAMPLE_QUOTE], meta: {} });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter initialEntries={['/dealflow/quotes']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ThemeProvider>
          <ToastProvider>
            <AuthProvider>
              <ApiClientProvider client={createApiClient({ fetchImpl: fetchMock as unknown as typeof fetch })}>
                <Routes>
                  <Route path="/dealflow" element={<DealflowDashboardPage />} />
                  <Route path="/dealflow/quotes" element={<QuotesListPage />} />
                  <Route path="/login" element={<p>Sales operations sign-in</p>} />
                </Routes>
              </ApiClientProvider>
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </MemoryRouter>,
    );

    expect(await screen.findAllByText('Restoring session…')).not.toHaveLength(0);
    expect(screen.queryByText('Sales operations sign-in')).not.toBeInTheDocument();

    await waitFor(() => {
      expect(resolveRefresh).toBeTypeOf('function');
    });
    resolveRefresh?.(
      jsonResponse({
        success: true,
        data: {
          user: STAFF_SESSION.user,
          tokens: { accessToken: STAFF_SESSION.accessToken, refreshToken: STAFF_SESSION.refreshToken },
        },
        meta: {},
      }),
    );

    expect(await screen.findByRole('heading', { name: 'Quotations' })).toBeInTheDocument();
    expect(screen.queryByText('Sales dashboard')).not.toBeInTheDocument();
    expect(screen.queryByText('Sales operations sign-in')).not.toBeInTheDocument();
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
    expect(screen.getByRole('button', { name: 'Contact vendor' })).toBeInTheDocument();
    expect(screen.getByText(/In which warehouse/)).toBeInTheDocument();
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

  it('renders contextual assistant insights from the selected quote', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/recommendations')) {
        return jsonResponse({ success: true, data: [], meta: {} });
      }
      if (url.includes('/catalog')) {
        return jsonResponse({ success: true, data: { customers: [], products: [], warehouses: [], stock: [], policies: [], chains: [] }, meta: {} });
      }
      return jsonResponse({ success: true, data: [SAMPLE_QUOTE], meta: {} });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderDealflow(<AssistantPage />, fetchMock as unknown as typeof fetch, '/dealflow/assistant');

    await waitFor(() => {
      expect(screen.getByText('Sales assistant')).toBeInTheDocument();
    });
    expect(screen.getByText(/approval is still pending/i)).toBeInTheDocument();
  });

  it('lists stock and discount anomalies from live quotes', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/anomalies')) {
        return jsonResponse({
          success: true,
          data: [
            {
              id: '11111111-1111-4111-8111-111111111199',
              type: 'inventory_shortfall',
              severity: 'warning',
              entityType: 'quote',
              entityId: SAMPLE_QUOTE.id,
              quoteId: SAMPLE_QUOTE.id,
              description: 'Requested quantity exceeds warehouse availability',
              status: 'open',
              detectedAt: '2026-09-06T00:00:00.000Z',
            },
          ],
          meta: {},
        });
      }
      if (url.includes('/catalog')) {
        return jsonResponse({
          success: true,
          data: {
            customers: [],
            products: [],
            warehouses: [{ id: 'west', name: 'West DC', fulfillmentCostPerUnit: 18 }],
            stock: [{ warehouseId: 'west', productId: SAMPLE_QUOTE.lines[0].productId, quantityOnHand: 4, reserved: 0 }],
            policies: [],
            chains: [],
          },
          meta: {},
        });
      }
      return jsonResponse({ success: true, data: [SAMPLE_QUOTE], meta: {} });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderDealflow(<AnomalyCenterPage />, fetchMock as unknown as typeof fetch, '/dealflow/anomalies');

    await waitFor(() => {
      expect(screen.getByText('Anomaly center')).toBeInTheDocument();
    });
    expect(screen.getByText(/Requested quantity exceeds warehouse availability/)).toBeInTheDocument();
  });

  it('shows seeded configuration tables from the catalog API', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        success: true,
        data: {
          customers: [SAMPLE_QUOTE.customer],
          products: [SAMPLE_QUOTE.lines[0].product],
          warehouses: [{ id: 'west', name: 'West DC', fulfillmentCostPerUnit: 18 }],
          stock: [],
          policies: [
            {
              id: 'pol-1',
              name: 'Default ceiling',
              warningPercent: 3,
              approvalPercent: 5,
              rejectPercent: 25,
              maxMarginImpactPercent: 40,
              priority: 100,
            },
          ],
          chains: [],
          quantityBreaks: [
            {
              id: 'brk-1',
              name: 'Core Gateway 10–49 volume',
              productId: SAMPLE_QUOTE.lines[0].productId,
              minQuantity: 10,
              maxQuantity: 49,
              adjustmentKind: 'fixed',
              adjustmentValue: 3700,
            },
          ],
          roleAuthorities: [
            {
              roleKey: 'staff',
              maxDiscountPercent: 5,
              minMarginPercent: 20,
              maxPriceOverridePercent: 0,
              canNegotiate: true,
              exceedAction: 'approval',
            },
          ],
          governance: {
            cumulativeWarningLimit: 2,
            materialDiscountDeltaPp: 2,
            materialTotalDeltaRatio: 0.08,
            highValueNetTotal: 25000,
            maxApprovalLevels: 3,
          },
        },
        meta: {},
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    renderDealflow(<SettingsPage />, fetchMock as unknown as typeof fetch, '/dealflow/settings');

    await waitFor(() => {
      expect(screen.getByText('Sales configuration')).toBeInTheDocument();
    });
    expect(screen.getByText('HW-CORE-1')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Quantity breaks' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Role ranges' })).toBeInTheDocument();
  });

  it('renders quotation status cards from live quote counts', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/catalog')) {
        return jsonResponse({ success: true, data: { customers: [], products: [], warehouses: [], stock: [], policies: [], chains: [] }, meta: {} });
      }
      return jsonResponse({ success: true, data: [SAMPLE_QUOTE], meta: {} });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderDealflow(<QuotesListPage />, fetchMock as unknown as typeof fetch, '/dealflow/quotes');

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Quotations' })).toBeInTheDocument();
    });
    expect(screen.getByText('Pending approval')).toBeInTheDocument();
    expect(screen.getByText('DF-00002')).toBeInTheDocument();
  });

  it('opens a dedicated approval detail screen from the live quote', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
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
      <MemoryRouter initialEntries={[`/dealflow/approvals/${SAMPLE_QUOTE.id}`]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ThemeProvider>
          <ToastProvider>
            <AuthProvider initialSession={STAFF_SESSION}>
              <ApiClientProvider client={createApiClient({ fetchImpl: fetchMock as unknown as typeof fetch })}>
                <Routes>
                  <Route path="/dealflow/approvals/:quoteId" element={<ApprovalDetailPage />} />
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
    expect(screen.getAllByText(/Requested 16% exceeds approval ceiling 5%/).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Open workspace' })).toBeInTheDocument();
  });

  it('shows a read-only product detail from the catalog API', async () => {
    const product = SAMPLE_QUOTE.lines[0].product;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/catalog')) {
        return jsonResponse({
          success: true,
          data: {
            customers: [SAMPLE_QUOTE.customer],
            products: [product],
            warehouses: [{ id: 'west', name: 'West DC', fulfillmentCostPerUnit: 18 }],
            stock: [{ warehouseId: 'west', productId: product?.id, quantityOnHand: 12, reserved: 2, incoming: 4 }],
            policies: [],
            chains: [],
            quantityBreaks: [],
          },
          meta: {},
        });
      }
      return jsonResponse({ success: true, data: [SAMPLE_QUOTE], meta: {} });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter initialEntries={[`/dealflow/catalog/products/${product?.id}`]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ThemeProvider>
          <ToastProvider>
            <AuthProvider initialSession={STAFF_SESSION}>
              <ApiClientProvider client={createApiClient({ fetchImpl: fetchMock as unknown as typeof fetch })}>
                <Routes>
                  <Route path="/dealflow/catalog/products/:productId" element={<ProductDetailPage />} />
                </Routes>
              </ApiClientProvider>
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Core Gateway' })).toBeInTheDocument();
    });
    expect(screen.getAllByText('HW-CORE-1').length).toBeGreaterThan(0);
    expect(screen.getByText('West DC')).toBeInTheDocument();
  });
});
