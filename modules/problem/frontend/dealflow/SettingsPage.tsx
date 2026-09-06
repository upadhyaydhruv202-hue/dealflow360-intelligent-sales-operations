import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '@/auth/AuthProvider';
import { useOptionalFeatures } from '@/features';
import { hasPermission } from '@/lib/rbac';
import { getApiErrorMessage } from '@/services/api';
import {
  Breadcrumb,
  Card,
  CardDescription,
  CardTitle,
  DataTable,
  type DataTableColumn,
  ErrorState,
  LoadingState,
  Modal,
  PageContainer,
  Search,
  Tabs,
  useToast,
} from '@/ui';

import { DealflowGate, deleteRecordItem, editRecordItem, RecordMenu } from './components';
import { formatMoney, formatPercent, roleLabel } from './format';
import { useCatalog } from './hooks';
import {
  deleteChain,
  deleteCustomer,
  deletePolicy,
  deleteProduct,
  deleteRelation,
  deleteStock,
  deleteWarehouse,
} from './api';
import {
  canManageDealflowCustomers,
  ChainEditor,
  CustomerEditor,
  PolicyEditor,
  ProductEditor,
  RelationEditor,
  StockEditor,
  WarehouseEditor,
} from './CatalogEditors';
import { QuantityBreakEditor, RoleAuthorityEditor } from './SettingsGovernanceForms';
import type {
  ApprovalChain,
  Customer,
  DiscountPolicy,
  Product,
  ProductRelation,
  QuantityBreak,
  RoleAuthority,
  StockLevel,
  Warehouse,
} from './types';

const ROLE_ROWS = [
  {
    id: 'staff',
    role: 'Sales Representative',
    account: 'demo.staff@example.com',
    can: 'Create quotes and products, send to manager, fulfill after lock (5% discount)',
    cannot: 'Approve a chain step or lock a deal',
  },
  {
    id: 'manager',
    role: 'Manager',
    account: 'demo.manager@example.com',
    can: 'Revise, finalize, and take the first approval step (10% discount)',
    cannot: 'Act as Finance or Final',
  },
  {
    id: 'finance',
    role: 'Finance Manager',
    account: 'demo.finance@example.com',
    can: 'Finance approval and commercial lock (15% discount)',
    cannot: 'Admin settings or catalog write',
  },
  {
    id: 'admin',
    role: 'Admin',
    account: 'demo.admin@example.com',
    can: 'Finance, Final, and every catalog permission after RBAC merge',
    cannot: 'A silent 40% discount ceiling',
  },
];

export function SettingsPage() {
  const { accessToken, user } = useAuth();
  const features = useOptionalFeatures();
  const demoMode = features?.isDemo() === true;
  const navigate = useNavigate();
  const { toast } = useToast();
  const catalog = useCatalog(accessToken);
  const canWriteCatalog = hasPermission(user, 'dealflow.catalog.write');
  const canWriteProducts = hasPermission(user, 'dealflow.catalog.products.write') || canWriteCatalog;
  const data = catalog.data;
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('products');
  const [editingCustomer, setEditingCustomer] = useState<Customer | 'new' | null>(null);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | 'new' | null>(null);
  const [editingStock, setEditingStock] = useState<StockLevel | null>(null);
  const [editingPolicy, setEditingPolicy] = useState<DiscountPolicy | null>(null);
  const [editingChain, setEditingChain] = useState<ApprovalChain | null>(null);
  const [editingRelation, setEditingRelation] = useState<ProductRelation | 'new' | null>(null);
  const canManageCustomers = canManageDealflowCustomers(user);
  const needle = query.trim().toLowerCase();

  const products = useMemo(() => {
    const rows = catalog.data?.products ?? [];
    if (!needle) return rows;
    return rows.filter((item) =>
      `${item.sku} ${item.name} ${item.category} ${item.billingType}`.toLowerCase().includes(needle),
    );
  }, [catalog.data?.products, needle]);

  const policies = useMemo(() => {
    const rows = catalog.data?.policies ?? [];
    if (!needle) return rows;
    return rows.filter((item) =>
      `${item.name} ${item.customerTier ?? ''} ${item.productCategory ?? ''}`.toLowerCase().includes(needle),
    );
  }, [catalog.data?.policies, needle]);

  const chains = useMemo(() => {
    const rows = catalog.data?.chains ?? [];
    if (!needle) return rows;
    return rows.filter((item) => item.name.toLowerCase().includes(needle));
  }, [catalog.data?.chains, needle]);

  const breaks = useMemo(() => {
    const rows = data?.quantityBreaks ?? [];
    if (!needle) return rows;
    const products = data?.products ?? [];
    return rows.filter((item) => {
      const sku = products.find((product) => product.id === item.productId)?.sku ?? '';
      return `${item.name} ${sku}`.toLowerCase().includes(needle);
    });
  }, [data?.products, data?.quantityBreaks, needle]);

  const customers = useMemo(() => {
    const rows = data?.customers ?? [];
    if (!needle) return rows;
    return rows.filter((item) => `${item.name} ${item.email} ${item.tier}`.toLowerCase().includes(needle));
  }, [data?.customers, needle]);

  const authorities = data?.roleAuthorities ?? [];
  const governance = data?.governance;
  const roleColumns: DataTableColumn<(typeof ROLE_ROWS)[number]>[] = [
    { id: 'role', header: 'Role', accessor: (row) => row.role },
    { id: 'can', header: 'Can', accessor: (row) => row.can },
    { id: 'cannot', header: 'Cannot', accessor: (row) => row.cannot },
  ];
  if (demoMode) {
    roleColumns.splice(1, 0, { id: 'account', header: 'Demo account', accessor: (row) => row.account });
  }

  return (
    <DealflowGate permission="dealflow.catalog.read">
      <PageContainer
        width="wide"
        breadcrumb={<Breadcrumb items={[{ label: 'Dashboard', to: '/dealflow' }, { label: 'Configuration' }]} />}
        title="Sales configuration"
        description="Catalog, quantity breaks, role ranges, and governance thresholds. Configuration users can edit pricing and authority rules; the API validates and audits every change."
        actions={
          <div className="flex flex-wrap gap-3 text-sm font-medium">
            <Link to="/dealflow/catalog" className="hover:underline">
              Open compact catalog
            </Link>
            <Link to="/dealflow/catalog/policies" className="hover:underline">
              Discount rules
            </Link>
          </div>
        }
      >
        {catalog.loading ? <LoadingState label="Loading configuration…" /> : null}
        {catalog.error ? <ErrorState message={catalog.error} onRetry={() => void catalog.reload()} /> : null}
        {data ? (
          <div className="space-y-6">
            <Search
              value={query}
              onChange={setQuery}
              placeholder="Search products, policies, chains, or pricing rules"
              aria-label="Filter configuration"
            />
            <Tabs
              value={tab}
              onChange={setTab}
              items={[
                {
                  id: 'products',
                  label: 'Products & pricing',
                  content: (
                    <div className="space-y-4">
                    <DataTable<Product>
                      caption="Products"
                      rowId={(row) => row.id}
                      rows={products}
                      onRowClick={(row) => navigate(`/dealflow/catalog/products/${row.id}`)}
                      emptyTitle="No products match"
                      emptyDescription="Clear the search to see the product catalog."
                      columns={[
                        { id: 'sku', header: 'SKU', accessor: (row) => row.sku },
                        { id: 'name', header: 'Name', accessor: (row) => row.name },
                        { id: 'category', header: 'Category', accessor: (row) => row.category },
                        { id: 'billing', header: 'Billing', accessor: (row) => row.billingType },
                        { id: 'freq', header: 'Cycle', accessor: (row) => row.billingFrequency ?? '—' },
                        { id: 'list', header: 'List', accessor: (row) => formatMoney(row.listPrice, true) },
                        { id: 'cost', header: 'Cost', accessor: (row) => formatMoney(row.cost, true) },
                        {
                          id: 'margin',
                          header: 'List margin',
                          accessor: (row) =>
                            formatPercent(row.listPrice ? ((row.listPrice - row.cost) / row.listPrice) * 100 : 0),
                        },
                        {
                          id: 'actions',
                          header: '',
                          accessor: (row) =>
                            canWriteProducts ? (
                              <RecordMenu
                                items={[
                                  editRecordItem(`Open ${row.sku} to edit catalog fields.`, () =>
                                    navigate(`/dealflow/catalog/products/${row.id}`),
                                  ),
                                  deleteRecordItem(
                                    `Permanently delete ${row.sku}. This cannot be undone if the SKU is unused.`,
                                    async () => {
                                      if (!accessToken) return;
                                      try {
                                        await deleteProduct(row.id, accessToken);
                                        toast({ title: 'Product deleted', variant: 'success' });
                                        await catalog.reload();
                                      } catch (caught) {
                                        toast({ title: getApiErrorMessage(caught, 'Product could not be deleted'), variant: 'error' });
                                      }
                                    },
                                    { confirmLabel: 'Delete product' },
                                  ),
                                ]}
                              />
                            ) : null,
                        },
                      ]}
                    />
                    <ProductEditor catalog={data} onSaved={() => catalog.reload()} />
                    <StockEditor catalog={data} onSaved={() => catalog.reload()} />
                    </div>
                  ),
                },
                {
                  id: 'policies',
                  label: 'Discount policies',
                  content: (
                    <div className="space-y-4">
                    <DataTable<DiscountPolicy>
                      caption="Discount policies"
                      rowId={(row) => row.id}
                      rows={policies}
                      onRowClick={() => navigate('/dealflow/catalog/policies')}
                      emptyTitle="No policies match"
                      columns={[
                        { id: 'name', header: 'Policy', accessor: (row) => row.name },
                        { id: 'warn', header: 'Warning', accessor: (row) => `${row.warningPercent}%` },
                        { id: 'approve', header: 'Approval', accessor: (row) => `${row.approvalPercent}%` },
                        { id: 'reject', header: 'Reject', accessor: (row) => `${row.rejectPercent}%` },
                        { id: 'margin', header: 'Max margin impact', accessor: (row) => `${row.maxMarginImpactPercent}%` },
                        {
                          id: 'scope',
                          header: 'Scope',
                          accessor: (row) => [row.customerTier, row.productCategory].filter(Boolean).join(' · ') || 'Default',
                        },
                        { id: 'priority', header: 'Priority', accessor: (row) => String(row.priority) },
                        {
                          id: 'actions',
                          header: '',
                          accessor: (row) =>
                            canWriteCatalog ? (
                              <RecordMenu
                                items={[
                                  editRecordItem(`Edit discount policy ${row.name}.`, () => setEditingPolicy(row)),
                                  deleteRecordItem(
                                    `Permanently delete ${row.name}. Historical quotes keep the policy they were assessed with.`,
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
                    <PolicyEditor catalog={data} onSaved={() => catalog.reload()} />
                    </div>
                  ),
                },
                {
                  id: 'pricing',
                  label: 'Quantity breaks',
                  content: (
                    <div className="space-y-4">
                    <DataTable<QuantityBreak>
                      caption="Quantity-based pricing rules"
                      rowId={(row) => row.id}
                      rows={breaks}
                      emptyTitle="No quantity breaks match"
                      emptyDescription="Configured volume prices appear here. Changing quantity on a quote re-evaluates these ranges."
                      columns={[
                        { id: 'name', header: 'Rule', accessor: (row) => row.name },
                        {
                          id: 'sku',
                          header: 'SKU',
                          accessor: (row) => data.products.find((product) => product.id === row.productId)?.sku ?? row.productId,
                        },
                        {
                          id: 'range',
                          header: 'Quantity',
                          accessor: (row) =>
                            row.maxQuantity == null ? `${row.minQuantity}+` : `${row.minQuantity}–${row.maxQuantity}`,
                        },
                        {
                          id: 'price',
                          header: 'Adjustment',
                          accessor: (row) =>
                            row.adjustmentKind === 'percent'
                              ? `${row.adjustmentValue}% of list`
                              : formatMoney(row.adjustmentValue, true),
                        },
                        { id: 'tier', header: 'Customer', accessor: (row) => row.customerTier ?? 'Any' },
                        { id: 'active', header: 'Active', accessor: (row) => (row.active === false ? 'No' : 'Yes') },
                      ]}
                    />
                    <QuantityBreakEditor catalog={data} onSaved={() => catalog.reload()} />
                    </div>
                  ),
                },
                {
                  id: 'authority',
                  label: 'Role ranges',
                  content: (
                    <div className="space-y-4">
                      <DataTable<RoleAuthority>
                        caption="Role discount and margin authority"
                        rowId={(row) => row.roleKey}
                        rows={authorities}
                        emptyTitle="No role ranges configured"
                        columns={[
                          { id: 'role', header: 'Role', accessor: (row) => row.roleKey },
                          { id: 'discount', header: 'Max discount', accessor: (row) => formatPercent(row.maxDiscountPercent) },
                          { id: 'margin', header: 'Min margin', accessor: (row) => formatPercent(row.minMarginPercent) },
                          {
                            id: 'override',
                            header: 'Max price override',
                            accessor: (row) => formatPercent(row.maxPriceOverridePercent),
                          },
                          { id: 'negotiate', header: 'Negotiate', accessor: (row) => (row.canNegotiate ? 'Yes' : 'No') },
                          { id: 'exceed', header: 'If exceeded', accessor: (row) => row.exceedAction },
                        ]}
                      />
                      {governance ? (
                        <Card>
                          <CardTitle>Governance thresholds</CardTitle>
                          <CardDescription className="mt-1">
                            High-value and material-change rules used by the existing approval engine. Admin is not
                            automatically added to a chain.
                          </CardDescription>
                          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                            <div>
                              <dt className="text-xs text-foreground-muted">High-value net</dt>
                              <dd className="font-medium">{formatMoney(governance.highValueNetTotal, true)}</dd>
                            </div>
                            <div>
                              <dt className="text-xs text-foreground-muted">Max approval levels</dt>
                              <dd className="font-medium">{governance.maxApprovalLevels}</dd>
                            </div>
                            <div>
                              <dt className="text-xs text-foreground-muted">Material discount Δ</dt>
                              <dd className="font-medium">{formatPercent(governance.materialDiscountDeltaPp)}</dd>
                            </div>
                            <div>
                              <dt className="text-xs text-foreground-muted">Cumulative warning limit</dt>
                              <dd className="font-medium">{governance.cumulativeWarningLimit}</dd>
                            </div>
                            <div>
                              <dt className="text-xs text-foreground-muted">Tax rate</dt>
                              <dd className="font-medium">{formatPercent(governance.taxRatePercent ?? 0)}</dd>
                            </div>
                            <div>
                              <dt className="text-xs text-foreground-muted">Stale quote days</dt>
                              <dd className="font-medium">{governance.staleQuoteDays ?? 7}</dd>
                            </div>
                          </dl>
                        </Card>
                      ) : null}
                      <RoleAuthorityEditor catalog={data} onSaved={() => catalog.reload()} />
                    </div>
                  ),
                },
                {
                  id: 'approvals',
                  label: 'Approval hierarchy',
                  content: (
                    <div className="space-y-4">
                      <DataTable<ApprovalChain>
                        caption="Approval chains"
                        rowId={(row) => row.id}
                        rows={chains}
                        emptyTitle="No chains match"
                        columns={[
                          { id: 'name', header: 'Chain', accessor: (row) => row.name },
                          { id: 'risk', header: 'Min risk', accessor: (row) => String(row.minRiskScore) },
                          { id: 'blend', header: 'Min blended', accessor: (row) => `${row.minBlendedDiscountPercent}%` },
                          {
                            id: 'steps',
                            header: 'Steps',
                            accessor: (row) =>
                              row.steps
                                .slice()
                                .sort((a, b) => a.stepOrder - b.stepOrder)
                                .map((step) => `${step.label} (${roleLabel(step.roleKey)})`)
                                .join(' → '),
                          },
                          {
                            id: 'actions',
                            header: '',
                            accessor: (row) =>
                              canWriteCatalog ? (
                                <RecordMenu
                                  items={[
                                    editRecordItem(`Edit approval chain ${row.name}.`, () => setEditingChain(row)),
                                    deleteRecordItem(
                                      `Permanently delete ${row.name} if unused. In-use chains must be archived instead.`,
                                      async () => {
                                        if (!accessToken) return;
                                        try {
                                          await deleteChain(row.id, accessToken);
                                          toast({ title: 'Approval chain deleted', variant: 'success' });
                                          await catalog.reload();
                                        } catch (caught) {
                                          toast({ title: getApiErrorMessage(caught, 'Chain could not be deleted'), variant: 'error' });
                                        }
                                      },
                                      { confirmLabel: 'Delete chain' },
                                    ),
                                  ]}
                                />
                              ) : null,
                          },
                        ]}
                      />
                      <p className="text-caption text-foreground-muted">
                        Automatic routing picks the qualifying chain with the highest min-risk + min-blended, then lowest
                        priority. Staff never approve.
                      </p>
                      <ChainEditor catalog={data} onSaved={() => catalog.reload()} />
                    </div>
                  ),
                },
                {
                  id: 'warehouses',
                  label: 'Warehouses',
                  content: (
                    <div className="space-y-4">
                      <DataTable<Warehouse>
                        caption="Warehouses"
                        rowId={(row) => row.id}
                        rows={data.warehouses}
                        columns={[
                          { id: 'name', header: 'Warehouse', accessor: (row) => row.name },
                          {
                            id: 'cost',
                            header: 'Fulfillment cost / unit',
                            accessor: (row) => formatMoney(row.fulfillmentCostPerUnit, true),
                          },
                          {
                            id: 'skus',
                            header: 'Stocked SKUs',
                            accessor: (row) =>
                              String(data.stock.filter((item) => item.warehouseId === row.id).length),
                          },
                          {
                            id: 'actions',
                            header: '',
                            accessor: (row) =>
                              canWriteCatalog ? (
                                <RecordMenu
                                  items={[
                                    editRecordItem(`Edit warehouse ${row.name}.`, () => setEditingWarehouse(row)),
                                    deleteRecordItem(
                                      `Permanently delete ${row.name}. This cannot be undone if it has no fulfillment allocations.`,
                                      async () => {
                                        if (!accessToken) return;
                                        try {
                                          await deleteWarehouse(row.id, accessToken);
                                          toast({ title: 'Warehouse deleted', variant: 'success' });
                                          await catalog.reload();
                                        } catch (caught) {
                                          toast({
                                            title: getApiErrorMessage(caught, 'Warehouse could not be deleted'),
                                            variant: 'error',
                                          });
                                        }
                                      },
                                      { confirmLabel: 'Delete warehouse' },
                                    ),
                                  ]}
                                />
                              ) : null,
                          },
                        ]}
                      />
                      <DataTable<StockLevel>
                        caption="Inventory positions"
                        rowId={(row) => `${row.warehouseId}-${row.productId}`}
                        rows={data.stock}
                        emptyTitle="No stock rows"
                        columns={[
                          {
                            id: 'warehouse',
                            header: 'Warehouse',
                            accessor: (row) =>
                              data.warehouses.find((item) => item.id === row.warehouseId)?.name ?? row.warehouseId,
                          },
                          {
                            id: 'sku',
                            header: 'SKU',
                            accessor: (row) => data.products.find((item) => item.id === row.productId)?.sku ?? row.productId,
                          },
                          { id: 'onHand', header: 'On hand', accessor: (row) => String(row.quantityOnHand) },
                          { id: 'reserved', header: 'Reserved', accessor: (row) => String(row.reserved) },
                          { id: 'incoming', header: 'Incoming', accessor: (row) => String(row.incoming ?? 0) },
                          {
                            id: 'available',
                            header: 'Available',
                            accessor: (row) => String(Math.max(0, row.quantityOnHand - row.reserved)),
                          },
                          {
                            id: 'actions',
                            header: '',
                            accessor: (row) =>
                              canWriteProducts ? (
                                <RecordMenu
                                  items={[
                                    editRecordItem('Edit this stock position.', () => setEditingStock(row)),
                                    deleteRecordItem(
                                      'Permanently remove this stock row. Quantity can be set to 0 instead if you want to keep the position.',
                                      async () => {
                                        if (!accessToken) return;
                                        try {
                                          await deleteStock(row.warehouseId, row.productId, accessToken);
                                          toast({ title: 'Stock row deleted', variant: 'success' });
                                          await catalog.reload();
                                        } catch (caught) {
                                          toast({ title: getApiErrorMessage(caught, 'Stock could not be deleted'), variant: 'error' });
                                        }
                                      },
                                      { confirmLabel: 'Delete stock row' },
                                    ),
                                  ]}
                                />
                              ) : null,
                          },
                        ]}
                      />
                      <p className="text-caption text-foreground-muted">
                        Incoming stock is visibility only. Available is on-hand minus reserved.
                      </p>
                      {canWriteCatalog ? (
                        <button type="button" className="text-sm font-medium hover:underline" onClick={() => setEditingWarehouse('new')}>
                          + Add warehouse
                        </button>
                      ) : null}
                      <WarehouseEditor onSaved={() => catalog.reload()} />
                    </div>
                  ),
                },
                {
                  id: 'customers',
                  label: 'Customers / contacts',
                  content: (
                    <div className="space-y-4">
                      <DataTable<Customer>
                        caption="Customers and contacts"
                        rowId={(row) => row.id}
                        rows={customers}
                        emptyTitle="No customers match"
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
                                      `Permanently delete ${row.name}. This cannot be undone if the customer has no quotations.`,
                                      async () => {
                                        if (!accessToken) return;
                                        try {
                                          await deleteCustomer(row.id, accessToken);
                                          toast({ title: 'Customer deleted', variant: 'success' });
                                          await catalog.reload();
                                        } catch (caught) {
                                          toast({
                                            title: getApiErrorMessage(caught, 'Customer could not be deleted'),
                                            variant: 'error',
                                          });
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
                      <CustomerEditor onSaved={() => catalog.reload()} />
                    </div>
                  ),
                },
                {
                  id: 'relations',
                  label: 'Recommendations',
                  content: (
                    <div className="space-y-4">
                      <DataTable<ProductRelation>
                        caption="Cross-sell and upsell rules"
                        rowId={(row) => row.id}
                        rows={data.relations ?? []}
                        emptyTitle="No recommendation rules"
                        columns={[
                          {
                            id: 'from',
                            header: 'From',
                            accessor: (row) => data.products.find((item) => item.id === row.productId)?.sku ?? row.productId,
                          },
                          {
                            id: 'to',
                            header: 'Recommend',
                            accessor: (row) =>
                              data.products.find((item) => item.id === row.recommendedProductId)?.sku ?? row.recommendedProductId,
                          },
                          { id: 'kind', header: 'Kind', accessor: (row) => row.kind.replace('_', '-') },
                          { id: 'reason', header: 'Reason', accessor: (row) => row.reason },
                          {
                            id: 'actions',
                            header: '',
                            accessor: (row) =>
                              canWriteCatalog ? (
                                <RecordMenu
                                  items={[
                                    editRecordItem('Edit this recommendation.', () => setEditingRelation(row)),
                                    deleteRecordItem(
                                      'Permanently delete this recommendation rule.',
                                      async () => {
                                        if (!accessToken) return;
                                        try {
                                          await deleteRelation(row.id, accessToken);
                                          toast({ title: 'Recommendation deleted', variant: 'success' });
                                          await catalog.reload();
                                        } catch (caught) {
                                          toast({
                                            title: getApiErrorMessage(caught, 'Recommendation could not be deleted'),
                                            variant: 'error',
                                          });
                                        }
                                      },
                                      { confirmLabel: 'Delete recommendation' },
                                    ),
                                  ]}
                                />
                              ) : null,
                          },
                        ]}
                      />
                      <RelationEditor catalog={data} onSaved={() => catalog.reload()} />
                    </div>
                  ),
                },
                {
                  id: 'billing',
                  label: 'Billing rules',
                  content: (
                    <div className="grid gap-4 md:grid-cols-2">
                      <Card>
                        <CardDescription>One-time</CardDescription>
                        <CardTitle className="mt-1">Hardware invoices</CardTitle>
                        <p className="mt-3 text-sm text-foreground-muted">
                          {(data.products.filter((item) => item.billingType === 'one_time').length)} SKUs
                          write one-time schedules when you generate billing. No payment is collected.
                        </p>
                      </Card>
                      <Card>
                        <CardDescription>Recurring</CardDescription>
                        <CardTitle className="mt-1">Software and services</CardTitle>
                        <p className="mt-3 text-sm text-foreground-muted">
                          {(data.products.filter((item) => item.billingType === 'recurring').length)} SKUs
                          write monthly or yearly schedules. Cancel exists on the API; the golden path generates only.
                        </p>
                      </Card>
                    </div>
                  ),
                },
                {
                  id: 'roles',
                  label: 'Roles & notifications',
                  content: (
                    <div className="space-y-4">
                      <DataTable<(typeof ROLE_ROWS)[number]>
                        caption="Role permissions"
                        rowId={(row) => row.id}
                        rows={ROLE_ROWS}
                        columns={roleColumns}
                      />
                      <p className="text-caption text-foreground-muted">
                        Notification rules stay on{' '}
                        <Link className="underline" to="/notifications">
                          Notifications
                        </Link>
                        {demoMode ? '. Seeded demo passwords are documented in the README and are not used in production.' : '.'}
                      </p>
                    </div>
                  ),
                },
              ]}
            />
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
            <Modal
              open={editingWarehouse !== null}
              onClose={() => setEditingWarehouse(null)}
              title={editingWarehouse && editingWarehouse !== 'new' ? `Edit ${editingWarehouse.name}` : 'Add warehouse'}
            >
              <WarehouseEditor
                key={editingWarehouse === 'new' ? 'new' : editingWarehouse?.id}
                existing={editingWarehouse && editingWarehouse !== 'new' ? editingWarehouse : undefined}
                onSaved={async () => {
                  await catalog.reload();
                  setEditingWarehouse(null);
                }}
              />
            </Modal>
            <Modal open={Boolean(editingStock)} onClose={() => setEditingStock(null)} title="Edit stock position">
              {editingStock ? (
                <StockEditor
                  key={`${editingStock.warehouseId}-${editingStock.productId}`}
                  catalog={data}
                  existing={editingStock}
                  onSaved={async () => {
                    await catalog.reload();
                    setEditingStock(null);
                  }}
                />
              ) : null}
            </Modal>
            <Modal open={Boolean(editingPolicy)} onClose={() => setEditingPolicy(null)} title="Edit discount policy">
              {editingPolicy ? (
                <PolicyEditor
                  key={editingPolicy.id}
                  catalog={data}
                  existing={editingPolicy}
                  onSaved={async () => {
                    await catalog.reload();
                    setEditingPolicy(null);
                  }}
                />
              ) : null}
            </Modal>
            <Modal open={Boolean(editingChain)} onClose={() => setEditingChain(null)} title="Edit approval chain">
              {editingChain ? (
                <ChainEditor
                  key={editingChain.id}
                  catalog={data}
                  existing={editingChain}
                  onSaved={async () => {
                    await catalog.reload();
                    setEditingChain(null);
                  }}
                />
              ) : null}
            </Modal>
            <Modal
              open={editingRelation !== null}
              onClose={() => setEditingRelation(null)}
              title={editingRelation && editingRelation !== 'new' ? 'Edit recommendation' : 'Add recommendation'}
            >
              <RelationEditor
                key={editingRelation === 'new' ? 'new' : editingRelation?.id}
                catalog={data}
                existing={editingRelation && editingRelation !== 'new' ? editingRelation : undefined}
                onSaved={async () => {
                  await catalog.reload();
                  setEditingRelation(null);
                }}
              />
            </Modal>
          </div>
        ) : null}
      </PageContainer>
    </DealflowGate>
  );
}
