import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '@/auth/AuthProvider';
import { Badge, Breadcrumb, ChartArea, DataTable, ErrorState, LoadingState, PageContainer, SimpleBarChart } from '@/ui';

import { DealflowGate, HealthBadge, StatusBadge } from './components';
import { formatMoney, formatPercent } from './format';
import { useAnomalies, useCatalog, useQuotes } from './hooks';
import { dashboardAnalytics, summarizeDealHealth } from './intelligence';
import type { DiscountPolicy, Product, QuoteView } from './types';

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
  const { accessToken } = useAuth();
  const navigate = useNavigate();
  const catalog = useCatalog(accessToken);
  return (
    <DealflowGate permission="dealflow.catalog.read">
      <PageContainer
        width="wide"
        breadcrumb={<Breadcrumb items={[{ label: 'Dashboard', to: '/dealflow' }, { label: 'Products / Policies' }]} />}
        title="Products & policies"
        description="Read-only catalog from the DealFlow360 seed. Open a SKU for stock and quantity breaks, or open discount rules for chains."
        actions={
          <div className="flex flex-wrap gap-3 text-sm font-medium">
            <Link className="hover:underline" to="/dealflow/catalog/policies">
              Discount rules & chains
            </Link>
            <Link className="hover:underline" to="/dealflow/settings">
              Configuration
            </Link>
          </div>
        }
      >
        {catalog.loading ? <LoadingState label="Loading catalog…" /> : null}
        {catalog.error ? <ErrorState message={catalog.error} onRetry={() => void catalog.reload()} /> : null}
        {catalog.data ? (
          <div className="space-y-6">
            <DataTable<Product>
              caption="Products"
              rowId={(row) => row.id}
              rows={catalog.data.products}
              onRowClick={(row) => navigate(`/dealflow/catalog/products/${row.id}`)}
              columns={[
                { id: 'sku', header: 'SKU', accessor: (row) => row.sku },
                { id: 'name', header: 'Name', accessor: (row) => row.name },
                { id: 'type', header: 'Billing', accessor: (row) => row.billingType },
                { id: 'price', header: 'List', accessor: (row) => formatMoney(row.listPrice, true) },
                { id: 'tier', header: 'Category', accessor: (row) => row.category },
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
              ]}
            />
            <div className="flex flex-wrap gap-2">
              {catalog.data.customers.map((customer) => (
                <Badge key={customer.id} tone="neutral">
                  {customer.name} · {customer.tier}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}
      </PageContainer>
    </DealflowGate>
  );
}
