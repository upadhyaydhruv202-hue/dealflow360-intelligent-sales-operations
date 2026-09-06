import { Link, useNavigate } from 'react-router-dom';
import { useMemo, useState } from 'react';

import { useAuth } from '@/auth/AuthProvider';
import { hasPermission } from '@/lib/rbac';
import { getApiErrorMessage } from '@/services/api';
import { Breadcrumb, Button, ChartArea, DataTable, ErrorState, LoadingState, Modal, PageContainer, Search, Select, SimpleBarChart, useToast } from '@/ui';

import { DealflowGate, deleteRecordItem, editRecordItem, HealthBadge, RecordMenu, StatusBadge } from './components';
import { canManageDealflowCustomers, CustomerEditor, ProductEditor, canWriteDealflowProducts } from './CatalogEditors';
import { deleteCustomer, deletePolicy, deleteProduct, upsertProduct } from './api';
import { formatDate, formatMoney, formatPercent } from './format';
import { useAnomalies, useCatalog, useQuotes } from './hooks';
import { dashboardAnalytics, summarizeDealHealth } from './intelligence';
import type { Customer, DiscountPolicy, Product, QuoteView } from './types';

interface HealthRow {
  id: string;
  quote: QuoteView;
  problem: string;
  action: string;
}

export function DealHealthPage() {
  const { accessToken } = useAuth();
  const navigate = useNavigate();
  const quotes = useQuotes(accessToken);
  const anomalies = useAnomalies(accessToken);
  const openAnomalies = (anomalies.data ?? []).filter((item) => item.status === 'open').slice(0, 6);
  const rows: HealthRow[] = (quotes.data ?? []).flatMap((quote) => {
    const items: HealthRow[] = [];
    if (quote.status === 'approval_required') {
      items.push({ id: `${quote.id}-stall`, quote, problem: 'Waiting on approval', action: 'Open approval center' });
    }
    if (quote.assessmentDecision === 'approval_required' || quote.riskScore >= 70) {
      items.push({ id: `${quote.id}-discount`, quote, problem: 'Discount / risk exception', action: 'Review risk panel' });
    }
    if (quote.fulfillment.backorderQuantity > 0) {
      items.push({ id: `${quote.id}-fulfill`, quote, problem: `Backorder ${quote.fulfillment.backorderQuantity}`, action: 'Review warehouse split' });
    }
    if ((quote.status === 'confirmed' || quote.status === 'billing') && quote.billing.length === 0) {
      items.push({ id: `${quote.id}-bill`, quote, problem: 'No billing schedule', action: 'Generate billing' });
    }
    return items;
  });

  return (
    <DealflowGate permission="dealflow.quotes.read">
      <PageContainer
        width="wide"
        breadcrumb={<Breadcrumb items={[{ label: 'Dashboard', to: '/dealflow' }, { label: 'Deal health' }]} />}
        title="Deal health"
        description="Per-deal health score plus open anomalies from the same PostgreSQL book. The anomaly center remains the disposition workspace."
        actions={
          <Link className="text-sm font-medium hover:underline" to="/dealflow/anomalies">
            Open anomaly center
          </Link>
        }
      >
        {quotes.loading ? <LoadingState label="Checking deals…" /> : null}
        {quotes.error ? <ErrorState message={quotes.error} onRetry={() => void quotes.reload()} /> : null}
        {!quotes.loading && !quotes.error ? (
          <div className="space-y-8">
            {openAnomalies.length > 0 ? (
              <section>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-foreground-muted">
                  Open anomalies
                </h2>
                <ul className="divide-y divide-edge border-y border-edge">
                  {openAnomalies.map((item) => (
                    <li key={item.id} className="py-3">
                      <p className="text-sm font-medium">{item.description}</p>
                      <p className="text-caption capitalize text-foreground-muted">
                        {item.severity} · {item.type.replaceAll('_', ' ')}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          <DataTable<HealthRow>
            caption="Deal exceptions"
            rowId={(row) => row.id}
            rows={rows}
            onRowClick={(row) => {
              const tab = row.problem.startsWith('Backorder')
                ? 'fulfillment'
                : row.problem.startsWith('No billing')
                  ? 'billing'
                  : row.problem.includes('approval') || row.problem.includes('Discount')
                    ? 'risk'
                    : 'lines';
              navigate(`/dealflow/quotes/${row.quote.id}?tab=${tab}`);
            }}
            emptyTitle="No exceptions"
            emptyDescription="Open quotes are currently within policy and stock."
            columns={[
              {
                id: 'quote',
                header: 'Deal',
                accessor: (row) => (
                  <Link className="font-medium hover:underline" to={`/dealflow/quotes/${row.quote.id}`}>
                    {row.quote.number}
                  </Link>
                ),
              },
              { id: 'customer', header: 'Customer', accessor: (row) => row.quote.customer?.name ?? '—' },
              {
                id: 'health',
                header: 'Health',
                accessor: (row) => <HealthBadge health={summarizeDealHealth(row.quote)} />,
              },
              {
                id: 'probability',
                header: 'Win %',
                accessor: (row) => `${summarizeDealHealth(row.quote).probability}%`,
              },
              { id: 'problem', header: 'Problem', accessor: (row) => row.problem },
              { id: 'status', header: 'Status', accessor: (row) => <StatusBadge status={row.quote.status} /> },
              { id: 'action', header: 'Recommended action', accessor: (row) => row.action },
            ]}
          />
          </div>
        ) : null}
      </PageContainer>
    </DealflowGate>
  );
}

export function ReportsPage() {
  const { accessToken } = useAuth();
  const quotes = useQuotes(accessToken);
  const rows = quotes.data ?? [];
  const analytics = dashboardAnalytics(rows);
  const openValue = analytics.openValue;
  const pending = analytics.pending.length;
  const backorders = rows.filter((item) => item.fulfillment.backorderQuantity > 0).length;
  const recommended = rows.filter((item) => item.lines.some((line) => line.recommendedFromId)).length;
  const healthy = rows.filter((item) => summarizeDealHealth(item).level === 'healthy').length;
  const mix = [
    { label: 'One-time', value: Math.round(analytics.oneTime) },
    { label: 'Monthly rec.', value: Math.round(analytics.recurring) },
    { label: 'Open', value: Math.round(analytics.openValue) },
    { label: 'Won', value: Math.round(analytics.wonValue) },
  ];
  const healthMix = [
    { label: 'Healthy', value: healthy },
    { label: 'Warning', value: rows.filter((item) => summarizeDealHealth(item).level === 'warning').length },
    { label: 'Critical', value: rows.filter((item) => summarizeDealHealth(item).level === 'critical').length },
  ];

  return (
    <DealflowGate permission="dealflow.quotes.read">
      <PageContainer
        width="wide"
        breadcrumb={<Breadcrumb items={[{ label: 'Dashboard', to: '/dealflow' }, { label: 'Reports' }]} />}
        title="Reports"
        description="Revenue, discount, margin, approval, fulfillment, and hybrid billing metrics computed from current quotations. Customer quote PDF exists; there is no report export."
        actions={
          <div className="flex flex-wrap gap-3 text-sm font-medium">
            <Link className="hover:underline" to="/dealflow/health">
              Deal health
            </Link>
            <Link className="hover:underline" to="/dealflow/anomalies">
              Anomalies
            </Link>
            <Link className="hover:underline" to="/dealflow/quotes">
              Quotations
            </Link>
            <Link className="hover:underline" to="/dealflow/catalog">
              Catalog
            </Link>
          </div>
        }
      >
        {quotes.loading ? <LoadingState label="Loading report…" /> : null}
        {quotes.error ? <ErrorState message={quotes.error} onRetry={() => void quotes.reload()} /> : null}
        {!quotes.loading && !quotes.error ? (
          <div className="grid gap-8 border-y border-edge py-6 md:grid-cols-2 xl:grid-cols-3">
            <div>
              <p className="text-caption uppercase tracking-[0.12em] text-foreground-muted">Quote volume</p>
              <p className="mt-2 text-[28px] font-semibold tracking-tight">{rows.length}</p>
            </div>
            <div>
              <p className="text-caption uppercase tracking-[0.12em] text-foreground-muted">Open deal value</p>
              <p className="mt-2 text-[28px] font-semibold tracking-tight">{formatMoney(openValue)}</p>
            </div>
            <div>
              <p className="text-caption uppercase tracking-[0.12em] text-foreground-muted">Approval workload</p>
              <p className="mt-2 text-[28px] font-semibold tracking-tight">{pending}</p>
            </div>
            <div>
              <p className="text-caption uppercase tracking-[0.12em] text-foreground-muted">Fulfillment issues</p>
              <p className="mt-2 text-[28px] font-semibold tracking-tight">{backorders}</p>
            </div>
            <div>
              <p className="text-caption uppercase tracking-[0.12em] text-foreground-muted">Upsell attached</p>
              <p className="mt-2 text-[28px] font-semibold tracking-tight">{recommended}</p>
              <p className="mt-1 text-caption text-foreground-muted">Quotes with a recommended line</p>
            </div>
            <div>
              <p className="text-caption uppercase tracking-[0.12em] text-foreground-muted">Average blended discount</p>
              <p className="mt-2 text-[28px] font-semibold tracking-tight">{formatPercent(analytics.avgDiscount)}</p>
            </div>
            <div>
              <p className="text-caption uppercase tracking-[0.12em] text-foreground-muted">Average margin</p>
              <p className="mt-2 text-[28px] font-semibold tracking-tight">{formatPercent(analytics.avgMargin)}</p>
            </div>
            <div>
              <p className="text-caption uppercase tracking-[0.12em] text-foreground-muted">Under negotiation</p>
              <p className="mt-2 text-[28px] font-semibold tracking-tight">{analytics.negotiating.length}</p>
            </div>
            <div>
              <p className="text-caption uppercase tracking-[0.12em] text-foreground-muted">Avg requested discount</p>
              <p className="mt-2 text-[28px] font-semibold tracking-tight">{formatPercent(analytics.avgRequestedDiscount)}</p>
            </div>
            <div>
              <p className="text-caption uppercase tracking-[0.12em] text-foreground-muted">Customer confirmation</p>
              <p className="mt-2 text-[28px] font-semibold tracking-tight">{formatPercent(analytics.confirmationRate)}</p>
            </div>
            <div>
              <p className="text-caption uppercase tracking-[0.12em] text-foreground-muted">Conversion</p>
              <p className="mt-2 text-[28px] font-semibold tracking-tight">{formatPercent(analytics.conversion)}</p>
            </div>
            <div>
              <p className="text-caption uppercase tracking-[0.12em] text-foreground-muted">Weighted forecast</p>
              <p className="mt-2 text-[28px] font-semibold tracking-tight">{formatMoney(analytics.forecast)}</p>
            </div>
          </div>
        ) : null}
        {!quotes.loading && !quotes.error ? (
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <ChartArea title="Commercial mix" description="One-time net, monthly recurring, open, and won value.">
              <SimpleBarChart title="Commercial mix" data={mix} />
            </ChartArea>
            <ChartArea title="Deal health" description="Healthy / warning / critical from the live book.">
              <SimpleBarChart title="Deal health" data={healthMix} />
            </ChartArea>
          </div>
        ) : null}
      </PageContainer>
    </DealflowGate>
  );
}

export function CatalogPage() {
  const { accessToken, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const catalog = useCatalog(accessToken);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [billingType, setBillingType] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [creating, setCreating] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | 'new' | null>(null);
  const canCreate = canWriteDealflowProducts(user);
  const canManageCustomers = canManageDealflowCustomers(user);
  const products = useMemo(() => {
    const rows = catalog.data?.products ?? [];
    const needle = query.trim().toLowerCase();
    const stock = catalog.data?.stock ?? [];
    return rows.filter((row) => {
      if (needle && !`${row.sku} ${row.name}`.toLowerCase().includes(needle)) return false;
      if (category && row.category !== category) return false;
      if (status === 'active' && row.active === false) return false;
      if (status === 'inactive' && row.active !== false) return false;
      if (billingType && row.billingType !== billingType) return false;
      if (warehouseId && !stock.some((item) => item.warehouseId === warehouseId && item.productId === row.id)) return false;
      return true;
    });
  }, [catalog.data?.products, catalog.data?.stock, query, category, status, billingType, warehouseId]);
  const categories = [...new Set((catalog.data?.products ?? []).map((item) => item.category))].sort();

  return (
    <DealflowGate permission="dealflow.catalog.read">
      <PageContainer
        width="wide"
        breadcrumb={<Breadcrumb items={[{ label: 'Dashboard', to: '/dealflow' }, { label: 'Products / Policies' }]} />}
        title="Product catalog"
        description="Live products from PostgreSQL. New SKUs become available in quotation, negotiation, recommendations, and billing after save."
        actions={
          <div className="flex flex-wrap gap-3 text-sm font-medium">
            {canCreate ? (
              <Button onClick={() => setCreating(true)}>+ Add new product</Button>
            ) : null}
            {canManageCustomers ? (
              <Button variant="secondary" onClick={() => setEditingCustomer('new')}>
                + Add customer
              </Button>
            ) : null}
            <Link className="hover:underline self-center" to="/dealflow/catalog/policies">
              Discount rules & chains
            </Link>
            {hasPermission(user, 'dealflow.catalog.read') ? (
              <Link className="hover:underline self-center" to="/dealflow/settings">
                Configuration
              </Link>
            ) : null}
          </div>
        }
      >
        {catalog.loading ? <LoadingState label="Loading catalog…" /> : null}
        {catalog.error ? <ErrorState message={catalog.error} onRetry={() => void catalog.reload()} /> : null}
        {catalog.data ? (
          <div className="space-y-6">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <Search value={query} onChange={setQuery} placeholder="Search products..." aria-label="Search products" />
              <Select
                label="Category"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                options={[{ value: '', label: 'All categories' }, ...categories.map((item) => ({ value: item, label: item }))]}
              />
              <Select
                label="Status"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                options={[
                  { value: '', label: 'All statuses' },
                  { value: 'active', label: 'Active' },
                  { value: 'inactive', label: 'Inactive' },
                ]}
              />
              <Select
                label="Type"
                value={billingType}
                onChange={(event) => setBillingType(event.target.value)}
                options={[
                  { value: '', label: 'All types' },
                  { value: 'one_time', label: 'One-time' },
                  { value: 'recurring', label: 'Subscription' },
                ]}
              />
              <Select
                label="Warehouse"
                value={warehouseId}
                onChange={(event) => setWarehouseId(event.target.value)}
                options={[
                  { value: '', label: 'All warehouses' },
                  ...(catalog.data?.warehouses ?? []).map((item) => ({ value: item.id, label: item.name })),
                ]}
              />
            </div>
            <DataTable<Product>
              caption="Products"
              rowId={(row) => row.id}
              rows={products}
              onRowClick={(row) => navigate(`/dealflow/catalog/products/${row.id}`)}
              emptyTitle="No products match"
              emptyDescription="Create a product or clear the filters."
              columns={[
                { id: 'sku', header: 'SKU', accessor: (row) => row.sku, sortable: true },
                { id: 'name', header: 'Name', accessor: (row) => row.name, sortable: true },
                { id: 'type', header: 'Type', accessor: (row) => (row.billingType === 'recurring' ? 'Subscription' : 'One-time') },
                { id: 'price', header: 'List', accessor: (row) => formatMoney(row.listPrice, true), sortable: true },
                { id: 'tier', header: 'Category', accessor: (row) => row.category },
                { id: 'status', header: 'Status', accessor: (row) => (row.active === false ? 'Inactive' : 'Active') },
                { id: 'created', header: 'Created', accessor: (row) => formatDate(row.createdAt), sortable: true },
                { id: 'updated', header: 'Updated', accessor: (row) => formatDate(row.updatedAt), sortable: true },
                {
                  id: 'actions',
                  header: '',
                  accessor: (row) =>
                    canCreate ? (
                      <RecordMenu
                        items={[
                          editRecordItem(`Open ${row.sku} to edit catalog fields.`, () =>
                            navigate(`/dealflow/catalog/products/${row.id}`),
                          ),
                          {
                            id: row.active === false ? 'activate' : 'archive',
                            label: row.active === false ? 'Activate' : 'Archive',
                            description:
                              row.active === false
                                ? `Activate ${row.sku} so it can be added to new quotations.`
                                : `Archive ${row.sku}. It stays in history and cannot be added to new quotations.`,
                            confirmLabel: row.active === false ? 'Activate' : 'Archive',
                            onConfirm: async () => {
                              if (!accessToken) return;
                              try {
                                await upsertProduct(
                                  {
                                    id: row.id,
                                    sku: row.sku,
                                    name: row.name,
                                    category: row.category,
                                    listPrice: row.listPrice,
                                    cost: row.cost,
                                    billingType: row.billingType,
                                    billingFrequency: row.billingFrequency,
                                    description: row.description,
                                    taxCategory: row.taxCategory,
                                    taxRatePercent: row.taxRatePercent,
                                    active: row.active === false,
                                  },
                                  accessToken,
                                );
                                toast({ title: row.active === false ? 'Product activated' : 'Product archived', variant: 'success' });
                                await catalog.reload();
                              } catch (caught) {
                                toast({ title: getApiErrorMessage(caught, 'Product could not be updated'), variant: 'error' });
                              }
                            },
                          },
                          {
                            id: 'delete',
                            label: 'Delete 🗑️',
                            description: `Permanently delete ${row.sku} if it is not used on any quotation. Used products must be archived.`,
                            confirmLabel: 'Delete product',
                            destructive: true,
                            onConfirm: async () => {
                              if (!accessToken) return;
                              try {
                                await deleteProduct(row.id, accessToken);
                                toast({ title: 'Product deleted', variant: 'success' });
                                await catalog.reload();
                              } catch (caught) {
                                toast({ title: getApiErrorMessage(caught, 'Product could not be deleted'), variant: 'error' });
                              }
                            },
                          },
                        ]}
                      />
                    ) : null,
                },
              ]}
            />
            <DataTable<DiscountPolicy>
              caption="Discount policies"
              rowId={(row) => row.id}
              rows={catalog.data.policies}
              onRowClick={() => navigate('/dealflow/catalog/policies')}
              columns={[
                { id: 'name', header: 'Policy', accessor: (row) => row.name },
                { id: 'warn', header: 'Warning', accessor: (row) => `${row.warningPercent}%` },
                { id: 'approve', header: 'Approval', accessor: (row) => `${row.approvalPercent}%` },
                { id: 'reject', header: 'Reject', accessor: (row) => `${row.rejectPercent}%` },
                {
                  id: 'scope',
                  header: 'Scope',
                  accessor: (row) => [row.customerTier, row.productCategory].filter(Boolean).join(' · ') || 'Default',
                },
                {
                  id: 'actions',
                  header: '',
                  accessor: (row) =>
                    hasPermission(user, 'dealflow.catalog.write') ? (
                      <RecordMenu
                        items={[
                          editRecordItem(`Edit policy ${row.name}.`, () => navigate('/dealflow/settings')),
                          deleteRecordItem(
                            `Permanently delete policy ${row.name}. Quotes already assessed keep their original policy snapshot.`,
                            async () => {
                              if (!accessToken) return;
                              try {
                                await deletePolicy(row.id, accessToken);
                                toast({ title: 'Policy deleted', variant: 'success' });
                                await catalog.reload();
                              } catch (caught) {
                                toast({ title: getApiErrorMessage(caught, 'Policy could not be deleted'), variant: 'error' });
                              }
                            },
                            { confirmLabel: 'Delete policy' },
                          ),
                        ]}
                      />
                    ) : null,
                },
              ]}
            />
            <DataTable<Customer>
              caption="Customers / contacts"
              rowId={(row) => row.id}
              rows={catalog.data.customers}
              emptyTitle="No customers"
              columns={[
                { id: 'name', header: 'Name', accessor: (row) => row.name },
                { id: 'email', header: 'Email', accessor: (row) => row.email },
                { id: 'tier', header: 'Tier', accessor: (row) => row.tier },
                {
                  id: 'actions',
                  header: '',
                  accessor: (row) =>
                    canManageCustomers ? (
                      <RecordMenu
                        items={[
                          editRecordItem(`Edit ${row.name}.`, () => setEditingCustomer(row)),
                          deleteRecordItem(
                            `Permanently delete ${row.name} if unused on quotations.`,
                            async () => {
                              if (!accessToken) return;
                              try {
                                await deleteCustomer(row.id, accessToken);
                                toast({ title: 'Customer deleted', variant: 'success' });
                                await catalog.reload();
                              } catch (caught) {
                                toast({ title: getApiErrorMessage(caught, 'Customer could not be deleted'), variant: 'error' });
                              }
                            },
                            { confirmLabel: 'Delete customer' },
                          ),
                        ]}
                      />
                    ) : null,
                },
              ]}
            />
          </div>
        ) : null}
        <Modal
          open={creating}
          onClose={() => setCreating(false)}
          title="Add new product"
          description="Saved products are stored in PostgreSQL and appear in quotation search immediately."
          size="lg"
        >
          {catalog.data ? (
            <ProductEditor
              catalog={catalog.data}
              compact
              onSaved={async (product) => {
                await catalog.reload();
                setCreating(false);
                if (product?.id) navigate(`/dealflow/catalog/products/${product.id}`);
              }}
            />
          ) : null}
        </Modal>
        <Modal
          open={editingCustomer !== null}
          onClose={() => setEditingCustomer(null)}
          title={editingCustomer && editingCustomer !== 'new' ? `Edit ${editingCustomer.name}` : 'Add customer'}
        >
          <CustomerEditor
            key={editingCustomer === 'new' ? 'new' : editingCustomer?.id}
            existing={editingCustomer && editingCustomer !== 'new' ? editingCustomer : undefined}
            onSaved={async () => {
              await catalog.reload();
              setEditingCustomer(null);
            }}
          />
        </Modal>
      </PageContainer>
    </DealflowGate>
  );
}
