import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

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
import { availableProductUnits } from './intelligence';
import type { ApprovalChain, DiscountPolicy, Product, Warehouse } from './types';

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
    id: 'admin',
    role: 'Admin',
    account: 'demo.admin@example.com',
    can: 'Finance, Final, and every catalog permission after RBAC merge',
    cannot: 'Treat the customer portal as an internal console',
  },
];

export function SettingsPage() {
  const { accessToken } = useAuth();
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

  return (
    <DealflowGate permission="dealflow.catalog.read">
      <PageContainer
        width="wide"
        breadcrumb={<Breadcrumb items={[{ label: 'Dashboard', to: '/dealflow' }, { label: 'Configuration' }]} />}
        title="Sales configuration"
        description="Live seeded catalog, discount ceilings, approval chains, warehouses, and billing rules. This screen does not invent write APIs — PostgreSQL remains the system of record via seed."
        actions={
          <Link to="/dealflow/catalog" className="text-sm font-medium hover:underline">
            Open compact catalog
          </Link>
        }
      >
        {catalog.loading ? <LoadingState label="Loading configuration…" /> : null}
        {catalog.error ? <ErrorState message={catalog.error} onRetry={() => void catalog.reload()} /> : null}
        {data ? (
          <div className="space-y-6">
            <Search
              value={query}
              onChange={setQuery}
              placeholder="Search products, policies, or chains"
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
