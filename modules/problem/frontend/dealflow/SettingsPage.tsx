import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '@/auth/AuthProvider';
import {
  Badge,
  Breadcrumb,
  Card,
  CardDescription,
  CardTitle,
  DataTable,
  ErrorState,
  LoadingState,
  PageContainer,
  Search,
  Tabs,
} from '@/ui';

import { DealflowGate } from './components';
import { formatMoney, formatPercent, roleLabel } from './format';
import { useCatalog } from './hooks';
import { QuantityBreakEditor, RoleAuthorityEditor } from './SettingsGovernanceForms';
import { availableProductUnits } from './intelligence';
import type { ApprovalChain, DiscountPolicy, Product, QuantityBreak, RoleAuthority, StockLevel, Warehouse } from './types';

const ROLE_ROWS = [
  {
    id: 'staff',
    role: 'Staff',
    account: 'demo.staff@example.com',
    can: 'Create, submit, fulfill, bill, confirm',
    cannot: 'Approve a chain step',
  },
  {
    id: 'manager',
    role: 'Manager',
    account: 'demo.manager@example.com',
    can: 'First approval step and quote write',
    cannot: 'Act as Finance or Final',
  },
  {
    id: 'finance',
    role: 'Finance',
    account: 'demo.finance@example.com',
    can: 'Billing, finance approvals, reports, and audit',
    cannot: 'Admin settings or catalog write',
  },
  {
    id: 'operations',
    role: 'Operations',
    account: 'demo.operations@example.com',
    can: 'Inventory, warehouses, fulfillment, and backorders',
    cannot: 'Finance billing or admin governance write',
  },
  {
    id: 'admin',
    role: 'Admin',
    account: 'demo.admin@example.com',
    can: 'Finance, Final, and every catalog permission after RBAC merge',
    cannot: 'Treat the customer portal as an internal console',
  },
];

export function SettingsPage() {
  const { accessToken } = useAuth();
  const navigate = useNavigate();
  const catalog = useCatalog(accessToken);
  const data = catalog.data;
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('products');
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

  const authorities = data?.roleAuthorities ?? [];
  const governance = data?.governance;

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
                    <DataTable<Product>
                      caption="Products"
                      rowId={(row) => row.id}
                      rows={products}
                      onRowClick={(row) => navigate(`/dealflow/catalog/products/${row.id}`)}
                      emptyTitle="No products match"
                      emptyDescription="Clear the search to see the seeded catalog."
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
                      ]}
                    />
                  ),
                },
                {
                  id: 'policies',
                  label: 'Discount policies',
                  content: (
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
                      ]}
                    />
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
                      emptyDescription="Seeded volume prices appear here. Changing quantity on a quote re-evaluates these ranges."
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
                        ]}
                      />
                      <p className="text-caption text-foreground-muted">
                        Automatic routing picks the qualifying chain with the highest min-risk + min-blended, then lowest
                        priority. Staff never approve.
                      </p>
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
                        ]}
                      />
                      <p className="text-caption text-foreground-muted">
                        Incoming stock is visibility only. Available is on-hand minus reserved.
                      </p>
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
                          {(data.products.filter((item) => item.billingType === 'one_time').length)} seeded SKUs
                          write one-time schedules when you generate billing. No payment is collected.
                        </p>
                      </Card>
                      <Card>
                        <CardDescription>Recurring</CardDescription>
                        <CardTitle className="mt-1">Software and services</CardTitle>
                        <p className="mt-3 text-sm text-foreground-muted">
                          {(data.products.filter((item) => item.billingType === 'recurring').length)} seeded SKUs
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
                        caption="Seeded roles"
                        rowId={(row) => row.id}
                        rows={ROLE_ROWS}
                        columns={[
                          { id: 'role', header: 'Role', accessor: (row) => row.role },
                          { id: 'account', header: 'Demo account', accessor: (row) => row.account },
                          { id: 'can', header: 'Can', accessor: (row) => row.can },
                          { id: 'cannot', header: 'Cannot', accessor: (row) => row.cannot },
                        ]}
                      />
                      <p className="text-caption text-foreground-muted">
                        Notification rules stay on{' '}
                        <Link className="underline" to="/notifications">
                          Notifications
                        </Link>
                        . Password for every seeded account is the demo password from the README.
                      </p>
                    </div>
                  ),
                },
              ]}
            />
            <div className="flex flex-wrap gap-2">
              {data.customers.map((customer) => (
                <Badge key={customer.id} tone="neutral">
                  {customer.name} · {customer.tier}
                </Badge>
              ))}
              {data.products.slice(0, 3).map((product) => (
                <Badge key={product.id} tone="info">
                  {product.sku} · {availableProductUnits(data.stock, product.id)} available
                </Badge>
              ))}
            </div>
          </div>
        ) : null}
      </PageContainer>
    </DealflowGate>
  );
}
