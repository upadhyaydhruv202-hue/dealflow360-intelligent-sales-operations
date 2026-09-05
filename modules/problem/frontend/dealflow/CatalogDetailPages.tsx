import { Link, useNavigate, useParams } from 'react-router-dom';

import { useAuth } from '@/auth/AuthProvider';
import { hasPermission } from '@/lib/rbac';
import { Badge, Breadcrumb, Card, CardTitle, DataTable, EmptyState, ErrorState, LoadingState, PageContainer } from '@/ui';

import { DealflowGate } from './components';
import { formatMoney, formatPercent, roleLabel } from './format';
import { useCatalog, useQuotes } from './hooks';
import { availableProductUnits } from './intelligence';
import type { ApprovalChain, DiscountPolicy, QuantityBreak, StockLevel } from './types';

export function ProductDetailPage() {
  const { productId } = useParams<{ productId: string }>();
  const { accessToken, user } = useAuth();
  const navigate = useNavigate();
  const catalog = useCatalog(accessToken);
  const quotes = useQuotes(accessToken);
  const product = catalog.data?.products.find((item) => item.id === productId);
  const stock = (catalog.data?.stock ?? []).filter((item) => item.productId === productId);
  const breaks = (catalog.data?.quantityBreaks ?? []).filter((item) => item.productId === productId);
  const related = (quotes.data ?? []).filter((quote) => quote.lines.some((line) => line.productId === productId));

  return (
    <DealflowGate permission="dealflow.catalog.read">
      <PageContainer
        width="wide"
        breadcrumb={
          <Breadcrumb
            items={[
              { label: 'Dashboard', to: '/dealflow' },
              { label: 'Products / Policies', to: '/dealflow/catalog' },
              { label: product?.sku ?? 'Product' },
            ]}
          />
        }
        title={product ? product.name : 'Product'}
        description="Read-only product, stock, and quantity-break view from the live catalog. Create and SKU edits are not available in the API."
        actions={
          <div className="flex flex-wrap gap-3">
            <Link className="text-sm font-medium hover:underline" to="/dealflow/catalog/policies">
              Discount rules
            </Link>
            {hasPermission(user, 'dealflow.catalog.read') ? (
              <Link className="text-sm font-medium hover:underline" to="/dealflow/settings">
                Configuration
              </Link>
            ) : null}
          </div>
        }
      >
        {catalog.loading ? <LoadingState label="Loading product…" /> : null}
        {catalog.error ? <ErrorState message={catalog.error} onRetry={() => void catalog.reload()} /> : null}
        {!catalog.loading && !catalog.error && !product ? (
          <EmptyState title="Product not found" description="Return to the catalog and choose a seeded SKU." />
        ) : null}
        {product ? (
          <div className="space-y-6">
            <section className="grid gap-6 border-y border-edge py-6 md:grid-cols-4">
              <div>
                <p className="text-caption uppercase tracking-[0.12em] text-foreground-muted">SKU</p>
                <p className="mt-2 text-lg font-semibold">{product.sku}</p>
                <p className="text-caption capitalize text-foreground-muted">{product.category}</p>
              </div>
              <div>
                <p className="text-caption uppercase tracking-[0.12em] text-foreground-muted">List price</p>
                <p className="mt-2 text-lg font-semibold">{formatMoney(product.listPrice, true)}</p>
                <p className="text-caption text-foreground-muted">Cost {formatMoney(product.cost, true)}</p>
              </div>
              <div>
                <p className="text-caption uppercase tracking-[0.12em] text-foreground-muted">Billing</p>
                <p className="mt-2 text-lg font-semibold capitalize">{product.billingType.replaceAll('_', ' ')}</p>
                <p className="text-caption text-foreground-muted">{product.billingFrequency ?? 'One-time'}</p>
              </div>
              <div>
                <p className="text-caption uppercase tracking-[0.12em] text-foreground-muted">Available</p>
                <p className="mt-2 text-lg font-semibold">{availableProductUnits(catalog.data?.stock, product.id)}</p>
                <p className="text-caption text-foreground-muted">On-hand minus reserved</p>
              </div>
            </section>
            <DataTable<StockLevel>
              caption="Warehouse stock"
              rowId={(row) => `${row.warehouseId}-${row.productId}`}
              rows={stock}
              emptyTitle="No warehouse rows"
              emptyDescription="Incoming stock is visibility-only. Reserved units stay allocated until a quote completes."
              columns={[
                {
                  id: 'warehouse',
                  header: 'Warehouse',
                  accessor: (row) => catalog.data?.warehouses.find((item) => item.id === row.warehouseId)?.name ?? row.warehouseId,
                },
                { id: 'onhand', header: 'On hand', accessor: (row) => String(row.quantityOnHand) },
                { id: 'reserved', header: 'Reserved', accessor: (row) => String(row.reserved) },
                { id: 'incoming', header: 'Incoming', accessor: (row) => String(row.incoming ?? 0) },
              ]}
            />
            <DataTable<QuantityBreak>
              caption="Quantity breaks"
              rowId={(row) => row.id}
              rows={breaks}
              emptyTitle="No quantity breaks"
              emptyDescription="Volume prices for this SKU are managed in Configuration."
              columns={[
                { id: 'name', header: 'Rule', accessor: (row) => row.name },
                {
                  id: 'range',
                  header: 'Quantity',
                  accessor: (row) => (row.maxQuantity == null ? `${row.minQuantity}+` : `${row.minQuantity}–${row.maxQuantity}`),
                },
                {
                  id: 'adj',
                  header: 'Adjustment',
                  accessor: (row) =>
                    row.adjustmentKind === 'percent' ? formatPercent(row.adjustmentValue) : formatMoney(row.adjustmentValue, true),
                },
                { id: 'tier', header: 'Tier', accessor: (row) => row.customerTier ?? 'Any' },
              ]}
            />
            <DataTable<(typeof related)[number]>
              caption="Quotes using this SKU"
              rowId={(row) => row.id}
              rows={related}
              onRowClick={(row) => navigate(`/dealflow/quotes/${row.id}`)}
              emptyTitle="No live quotes"
              emptyDescription="Create a quotation and add this product as a line."
              columns={[
                { id: 'number', header: 'Quote', accessor: (row) => row.number },
                { id: 'customer', header: 'Customer', accessor: (row) => row.customer?.name ?? '—' },
                { id: 'qty', header: 'Qty', accessor: (row) => String(row.lines.filter((line) => line.productId === product.id).reduce((sum, line) => sum + line.quantity, 0)) },
                { id: 'amount', header: 'Net', accessor: (row) => formatMoney(row.netTotal) },
                { id: 'status', header: 'Status', accessor: (row) => row.status.replaceAll('_', ' ') },
              ]}
            />
          </div>
        ) : null}
      </PageContainer>
    </DealflowGate>
  );
}

export function DiscountPoliciesPage() {
  const { accessToken, user } = useAuth();
  const catalog = useCatalog(accessToken);
  const policies = catalog.data?.policies ?? [];
  const chains = catalog.data?.chains ?? [];
  const canConfigure = hasPermission(user, 'dealflow.catalog.write');

  return (
    <DealflowGate permission="dealflow.catalog.read">
      <PageContainer
        width="wide"
        breadcrumb={
          <Breadcrumb
            items={[
              { label: 'Dashboard', to: '/dealflow' },
              { label: 'Products / Policies', to: '/dealflow/catalog' },
              { label: 'Discount rules' },
            ]}
          />
        }
        title="Discount rules & approval chains"
        description="Tier and category ceilings plus the approval chains the backend attaches to risky quotes. Writers edit these in Configuration."
        actions={
          <Link className="text-sm font-medium hover:underline" to="/dealflow/settings">
            {canConfigure ? 'Edit in configuration' : 'Open configuration'}
          </Link>
        }
      >
        {catalog.loading ? <LoadingState label="Loading policies…" /> : null}
        {catalog.error ? <ErrorState message={catalog.error} onRetry={() => void catalog.reload()} /> : null}
        {catalog.data ? (
          <div className="space-y-6">
            <Card>
              <CardTitle>How this is used</CardTitle>
              <p className="mt-3 text-sm text-foreground-muted">
                Quote assessment reads these policies and chains from PostgreSQL. There is no separate discount engine in
                the UI. Changing a quote line re-runs the same backend rules.
              </p>
            </Card>
            <DataTable<DiscountPolicy>
              caption="Discount policies"
              rowId={(row) => row.id}
              rows={policies}
              emptyTitle="No policies"
              columns={[
                { id: 'name', header: 'Policy', accessor: (row) => row.name },
                { id: 'tier', header: 'Customer tier', accessor: (row) => row.customerTier ?? 'Any' },
                { id: 'category', header: 'Category', accessor: (row) => row.productCategory ?? 'Any' },
                { id: 'warn', header: 'Warning', accessor: (row) => `${row.warningPercent}%` },
                { id: 'approve', header: 'Approval', accessor: (row) => `${row.approvalPercent}%` },
                { id: 'reject', header: 'Reject', accessor: (row) => `${row.rejectPercent}%` },
                { id: 'margin', header: 'Max margin impact', accessor: (row) => `${row.maxMarginImpactPercent}%` },
              ]}
            />
            <DataTable<ApprovalChain>
              caption="Approval chains"
              rowId={(row) => row.id}
              rows={chains}
              emptyTitle="No approval chains"
              columns={[
                { id: 'name', header: 'Chain', accessor: (row) => row.name },
                { id: 'risk', header: 'Min risk', accessor: (row) => String(row.minRiskScore) },
                { id: 'discount', header: 'Min blended %', accessor: (row) => `${row.minBlendedDiscountPercent}%` },
                {
                  id: 'steps',
                  header: 'Steps',
                  accessor: (row) => row.steps.map((step) => `${step.label} (${roleLabel(step.roleKey)})`).join(' → '),
                },
              ]}
            />
            <div className="flex flex-wrap gap-2">
              {(catalog.data.roleAuthorities ?? []).map((item) => (
                <Badge key={item.roleKey} tone="neutral">
                  {item.roleKey} · max {item.maxDiscountPercent}%
                </Badge>
              ))}
            </div>
            <Link
              className="inline-flex h-10 items-center rounded-control border border-edge px-3.5 text-sm font-medium hover:bg-surface-muted"
              to="/dealflow/settings"
            >
              Open configuration editors
            </Link>
          </div>
        ) : null}
      </PageContainer>
    </DealflowGate>
  );
}
