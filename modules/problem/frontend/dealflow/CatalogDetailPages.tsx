import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { useAuth } from '@/auth/AuthProvider';
import { hasPermission } from '@/lib/rbac';
import { getApiErrorMessage } from '@/services/api';
import { Breadcrumb, Button, Card, CardTitle, DataTable, EmptyState, ErrorState, LoadingState, PageContainer, useToast } from '@/ui';

import { ChainEditor, PolicyEditor, ProductEditor, StockEditor, canWriteDealflowProducts } from './CatalogEditors';
import { DealflowGate, RecordMenu } from './components';
import { formatDate, formatMoney, formatPercent, roleLabel } from './format';
import { useCatalog, useQuotes } from './hooks';
import { availableProductUnits } from './intelligence';
import { deleteChain, deletePolicy, deleteProduct, listProductAudit, upsertChain, upsertProduct } from './api';
import type { ApprovalChain, AuditEvent, DiscountPolicy, QuantityBreak, StockLevel } from './types';

export function ProductDetailPage() {
  const { productId } = useParams<{ productId: string }>();
  const { accessToken, user } = useAuth();
  const navigate = useNavigate();
  const catalog = useCatalog(accessToken);
  const quotes = useQuotes(accessToken);
  const { toast } = useToast();
  const product = catalog.data?.products.find((item) => item.id === productId);
  const stock = (catalog.data?.stock ?? []).filter((item) => item.productId === productId);
  const breaks = (catalog.data?.quantityBreaks ?? []).filter((item) => item.productId === productId);
  const related = (quotes.data ?? []).filter((quote) => quote.lines.some((line) => line.productId === productId));
  const canWrite = canWriteDealflowProducts(user);
  const canReadAudit = hasPermission(user, 'audit.read');
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const policies = (catalog.data?.policies ?? []).filter(
    (item) => !item.productCategory || item.productCategory === product?.category,
  );

  useEffect(() => {
    if (!accessToken || !productId || !canReadAudit) {
      setAudit([]);
      return;
    }
    void listProductAudit(productId, accessToken)
      .then(setAudit)
      .catch(() => setAudit([]));
  }, [accessToken, productId, canReadAudit, catalog.data?.products]);

  async function setActive(next: boolean) {
    if (!accessToken || !product) return;
    try {
      await upsertProduct(
        {
          id: product.id,
          sku: product.sku,
          name: product.name,
          category: product.category,
          listPrice: product.listPrice,
          cost: product.cost,
          billingType: product.billingType,
          billingFrequency: product.billingFrequency,
          description: product.description,
          taxCategory: product.taxCategory,
          taxRatePercent: product.taxRatePercent,
          active: next,
        },
        accessToken,
      );
      toast({ title: next ? 'Product activated' : 'Product deactivated', variant: 'success' });
      await catalog.reload();
    } catch (caught) {
      toast({ title: getApiErrorMessage(caught, 'Product status could not be updated'), variant: 'error' });
    }
  }

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
        description="Live product, stock, quantity-break, and policy view. Historical quotations keep the prices they were sold at."
        actions={
          <div className="flex flex-wrap gap-3">
            <Link className="text-sm font-medium hover:underline" to="/dealflow/catalog/policies">
              View policies
            </Link>
            <a className="text-sm font-medium hover:underline self-center" href="#product-usage">
              View usage
            </a>
            {canReadAudit ? (
              <a className="text-sm font-medium hover:underline self-center" href="#product-audit">
                View audit history
              </a>
            ) : null}
            {canWrite && product?.active !== false ? (
              <Button size="sm" variant="secondary" onClick={() => void setActive(false)}>
                Deactivate
              </Button>
            ) : null}
            {canWrite && product?.active === false ? (
              <Button size="sm" onClick={() => void setActive(true)}>
                Activate
              </Button>
            ) : null}
            {canWrite && product ? (
              <RecordMenu
                items={[
                  {
                    id: related.length ? 'archive' : 'delete',
                    label: related.length ? 'Archive' : 'Delete 🗑️',
                    description: related.length
                      ? `${product.sku} is used on quotations, so it cannot be deleted. Archive it instead.`
                      : `Permanently delete ${product.sku} if it is not used on quotations.`,
                    confirmLabel: related.length ? 'Archive product' : 'Delete product',
                    destructive: true,
                    onConfirm: async () => {
                      if (!accessToken || !product) return;
                      try {
                        if (related.length) {
                          await setActive(false);
                          return;
                        }
                        await deleteProduct(product.id, accessToken);
                        toast({ title: 'Product deleted', variant: 'success' });
                        navigate('/dealflow/catalog');
                      } catch (caught) {
                        toast({ title: getApiErrorMessage(caught, 'Product could not be deleted'), variant: 'error' });
                      }
                    },
                  },
                ]}
              />
            ) : null}
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
          <EmptyState title="Product not found" description="Return to the catalog and choose a product." />
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
                <p className="mt-2 text-lg font-semibold capitalize">{product.billingType === 'recurring' ? 'Subscription' : 'One-time'}</p>
                <p className="text-caption text-foreground-muted">{product.billingFrequency ?? 'One-time'} · {product.active === false ? 'Inactive' : 'Active'}</p>
              </div>
              <div>
                <p className="text-caption uppercase tracking-[0.12em] text-foreground-muted">Available</p>
                <p className="mt-2 text-lg font-semibold">{availableProductUnits(catalog.data?.stock, product.id)}</p>
                <p className="text-caption text-foreground-muted">On-hand minus reserved</p>
              </div>
              {product.description ? (
                <div className="md:col-span-4">
                  <p className="text-caption uppercase tracking-[0.12em] text-foreground-muted">Description</p>
                  <p className="mt-2 text-sm">{product.description}</p>
                </div>
              ) : null}
              <div>
                <p className="text-caption uppercase tracking-[0.12em] text-foreground-muted">Tax</p>
                <p className="mt-2 text-sm">{product.taxCategory ?? 'Default'} {product.taxRatePercent != null ? `· ${product.taxRatePercent}%` : ''}</p>
              </div>
              <div>
                <p className="text-caption uppercase tracking-[0.12em] text-foreground-muted">Created</p>
                <p className="mt-2 text-sm">{formatDate(product.createdAt)}</p>
              </div>
              <div>
                <p className="text-caption uppercase tracking-[0.12em] text-foreground-muted">Updated</p>
                <p className="mt-2 text-sm">{formatDate(product.updatedAt)}</p>
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
              emptyDescription="Volume prices for this SKU can be set when editing the product."
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
            <DataTable<(typeof policies)[number]>
              caption="Matching discount policies"
              rowId={(row) => row.id}
              rows={policies}
              emptyTitle="No category-specific policies"
              emptyDescription="This SKU uses global discount policy and role authority."
              columns={[
                { id: 'name', header: 'Policy', accessor: (row) => row.name },
                { id: 'warn', header: 'Warning', accessor: (row) => `${row.warningPercent}%` },
                { id: 'approve', header: 'Approval', accessor: (row) => `${row.approvalPercent}%` },
                { id: 'reject', header: 'Reject', accessor: (row) => `${row.rejectPercent}%` },
              ]}
            />
            <div id="product-usage">
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
            {canReadAudit ? (
              <div id="product-audit">
                <DataTable<AuditEvent>
                  caption="Audit history"
                  rowId={(row) => row.id}
                  rows={audit}
                  emptyTitle="No catalog audit events"
                  emptyDescription="Create or edit this SKU to record catalog.product_* events."
                  columns={[
                    { id: 'action', header: 'Action', accessor: (row) => row.action },
                    { id: 'actor', header: 'Actor', accessor: (row) => row.actorId ?? '—' },
                    { id: 'when', header: 'When', accessor: (row) => formatDate(row.timestamp) },
                    { id: 'status', header: 'Status', accessor: (row) => row.status },
                  ]}
                />
              </div>
            ) : null}
            {catalog.data ? (
              <>
                <ProductEditor catalog={catalog.data} existing={product} onSaved={() => catalog.reload()} />
                <StockEditor catalog={catalog.data} onSaved={() => catalog.reload()} />
              </>
            ) : null}
          </div>
        ) : null}
      </PageContainer>
    </DealflowGate>
  );
}

export function DiscountPoliciesPage() {
  const { accessToken, user } = useAuth();
  const catalog = useCatalog(accessToken);
  const { toast } = useToast();
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
                the UI. Changing a quote line re-runs the same backend rules. Sales Representatives cannot raise authority
                ceilings from product creation.
              </p>
            </Card>
            {canConfigure ? <PolicyEditor catalog={catalog.data} onSaved={() => catalog.reload()} /> : null}
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
                {
                  id: 'actions',
                  header: '',
                  accessor: (row) =>
                    canConfigure ? (
                      <RecordMenu
                        items={[
                          {
                            id: 'delete',
                            label: 'Delete',
                            description: `Permanently delete ${row.name}. Historical quote assessments keep the policy they used.`,
                            confirmLabel: 'Delete policy',
                            destructive: true,
                            onConfirm: async () => {
                              if (!accessToken) return;
                              try {
                                await deletePolicy(row.id, accessToken);
                                toast({ title: 'Policy deleted', variant: 'success' });
                                await catalog.reload();
                              } catch (caught) {
                                toast({ title: getApiErrorMessage(caught, 'Policy could not be deleted'), variant: 'error' });
                              }
                            },
                          },
                        ]}
                      />
                    ) : null,
                },
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
                {
                  id: 'actions',
                  header: '',
                  accessor: (row) =>
                    canConfigure ? (
                      <RecordMenu
                        items={[
                          {
                            id: 'archive',
                            label: row.active === false ? 'Activate' : 'Archive',
                            description:
                              row.active === false
                                ? `Activate ${row.name} so new quotations can use this chain.`
                                : `Archive ${row.name}. Existing approval records stay intact.`,
                            confirmLabel: row.active === false ? 'Activate' : 'Archive',
                            onConfirm: async () => {
                              if (!accessToken) return;
                              try {
                                await upsertChain({ ...row, active: row.active === false }, accessToken);
                                toast({ title: row.active === false ? 'Chain activated' : 'Chain archived', variant: 'success' });
                                await catalog.reload();
                              } catch (caught) {
                                toast({ title: getApiErrorMessage(caught, 'Chain could not be updated'), variant: 'error' });
                              }
                            },
                          },
                          {
                            id: 'delete',
                            label: 'Delete',
                            description: `Permanently delete ${row.name} if no quotation uses it. In-use chains must be archived.`,
                            confirmLabel: 'Delete chain',
                            destructive: true,
                            onConfirm: async () => {
                              if (!accessToken) return;
                              try {
                                await deleteChain(row.id, accessToken);
                                toast({ title: 'Approval chain deleted', variant: 'success' });
                                await catalog.reload();
                              } catch (caught) {
                                toast({ title: getApiErrorMessage(caught, 'Chain could not be deleted'), variant: 'error' });
                              }
                            },
                          },
                        ]}
                      />
                    ) : null,
                },
              ]}
            />
            <PolicyEditor catalog={catalog.data} onSaved={() => catalog.reload()} />
            <ChainEditor catalog={catalog.data} onSaved={() => catalog.reload()} />
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
