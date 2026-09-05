import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '@/auth/AuthProvider';
import { Badge, Breadcrumb, Card, CardTitle, DataTable, ErrorState, LoadingState, PageContainer } from '@/ui';

import { DealflowGate, StatusBadge } from './components';
import { formatMoney, formatPercent, OPEN_STATUSES } from './format';
import { useCatalog, useQuotes } from './hooks';
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
        description="Actionable exceptions derived from live quotes. No synthetic anomaly scores."
      >
        {quotes.loading ? <LoadingState label="Checking deals…" /> : null}
        {quotes.error ? <ErrorState message={quotes.error} onRetry={() => void quotes.reload()} /> : null}
        {!quotes.loading && !quotes.error ? (
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
              { id: 'problem', header: 'Problem', accessor: (row) => row.problem },
              { id: 'status', header: 'Status', accessor: (row) => <StatusBadge status={row.quote.status} /> },
              { id: 'action', header: 'Recommended action', accessor: (row) => row.action },
            ]}
          />
        ) : null}
      </PageContainer>
    </DealflowGate>
  );
}

export function ReportsPage() {
  const { accessToken } = useAuth();
  const quotes = useQuotes(accessToken);
  const rows = quotes.data ?? [];
  const openValue = rows.filter((item) => OPEN_STATUSES.includes(item.status)).reduce((sum, item) => sum + item.netTotal, 0);
  const pending = rows.filter((item) => item.status === 'approval_required').length;
  const backorders = rows.filter((item) => item.fulfillment.backorderQuantity > 0).length;
  const recommended = rows.filter((item) => item.lines.some((line) => line.recommendedFromId)).length;

  return (
    <DealflowGate permission="dealflow.quotes.read">
      <PageContainer
        width="wide"
        breadcrumb={<Breadcrumb items={[{ label: 'Dashboard', to: '/dealflow' }, { label: 'Reports' }]} />}
        title="Reports"
        description="Book metrics computed from current quotations. No separate export subsystem was added."
      >
        {quotes.loading ? <LoadingState label="Loading report…" /> : null}
        {quotes.error ? <ErrorState message={quotes.error} onRetry={() => void quotes.reload()} /> : null}
        {!quotes.loading && !quotes.error ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardTitle>Quote volume</CardTitle>
              <p className="mt-3 text-3xl font-semibold">{rows.length}</p>
            </Card>
            <Card>
              <CardTitle>Open deal value</CardTitle>
              <p className="mt-3 text-3xl font-semibold">{formatMoney(openValue)}</p>
            </Card>
            <Card>
              <CardTitle>Approval workload</CardTitle>
              <p className="mt-3 text-3xl font-semibold">{pending}</p>
            </Card>
            <Card>
              <CardTitle>Fulfillment issues</CardTitle>
              <p className="mt-3 text-3xl font-semibold">{backorders}</p>
            </Card>
            <Card>
              <CardTitle>Upsell attached</CardTitle>
              <p className="mt-3 text-3xl font-semibold">{recommended}</p>
              <p className="mt-1 text-xs text-foreground-muted">Quotes with a recommended line</p>
            </Card>
            <Card>
              <CardTitle>Average blended discount</CardTitle>
              <p className="mt-3 text-3xl font-semibold">
                {formatPercent(rows.length ? rows.reduce((sum, item) => sum + item.blendedDiscountPercent, 0) / rows.length : 0)}
              </p>
            </Card>
          </div>
        ) : null}
      </PageContainer>
    </DealflowGate>
  );
}

export function CatalogPage() {
  const { accessToken } = useAuth();
  const catalog = useCatalog(accessToken);
  return (
    <DealflowGate permission="dealflow.catalog.read">
      <PageContainer
        width="wide"
        breadcrumb={<Breadcrumb items={[{ label: 'Dashboard', to: '/dealflow' }, { label: 'Products / Policies' }]} />}
        title="Products & policies"
        description="Read-only catalog from the DealFlow360 seed. Pricing rules are not edited in the frontend."
      >
        {catalog.loading ? <LoadingState label="Loading catalog…" /> : null}
        {catalog.error ? <ErrorState message={catalog.error} onRetry={() => void catalog.reload()} /> : null}
        {catalog.data ? (
          <div className="space-y-6">
            <DataTable<Product>
              caption="Products"
              rowId={(row) => row.id}
              rows={catalog.data.products}
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
