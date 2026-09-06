import { useState } from 'react';

import { useAuth } from '@/auth/AuthProvider';
import { hasPermission } from '@/lib/rbac';
import { getApiErrorMessage } from '@/services/api';
import { Alert, Button, Input, Select, useToast } from '@/ui';

import { upsertChain, upsertCustomer, upsertPolicy, upsertProduct, upsertRelation, upsertStock, upsertWarehouse } from './api';
import type { ApprovalChain, Customer, DealflowCatalog, DiscountPolicy, Product, ProductRelation, StockLevel, Warehouse } from './types';

export function canWriteDealflowProducts(user: { permissions?: string[] } | null | undefined) {
  return hasPermission(user, 'dealflow.catalog.products.write') || hasPermission(user, 'dealflow.catalog.write');
}

type BreakDraft = {
  name: string;
  minQuantity: string;
  maxQuantity: string;
  adjustmentKind: 'fixed' | 'percent';
  adjustmentValue: string;
};

export function ProductEditor({
  catalog,
  onSaved,
  existing,
  compact,
}: {
  catalog: DealflowCatalog;
  onSaved: (product?: Product) => Promise<void> | void;
  existing?: Product;
  compact?: boolean;
}) {
  const { accessToken, user } = useAuth();
  const { toast } = useToast();
  const canWrite = canWriteDealflowProducts(user);
  const canWritePolicies = hasPermission(user, 'dealflow.catalog.write');
  const [sku, setSku] = useState(existing?.sku ?? '');
  const [name, setName] = useState(existing?.name ?? '');
  const [category, setCategory] = useState(existing?.category ?? 'hardware');
  const [listPrice, setListPrice] = useState(String(existing?.listPrice ?? 0));
  const [cost, setCost] = useState(String(existing?.cost ?? 0));
  const [billingType, setBillingType] = useState<Product['billingType']>(existing?.billingType ?? 'one_time');
  const [billingFrequency, setBillingFrequency] = useState(existing?.billingFrequency ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [taxCategory, setTaxCategory] = useState(existing?.taxCategory ?? '');
  const [taxRatePercent, setTaxRatePercent] = useState(String(existing?.taxRatePercent ?? ''));
  const [active, setActive] = useState(existing?.active !== false);
  const [stockByWarehouse, setStockByWarehouse] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      catalog.warehouses.map((warehouse) => {
        const row = catalog.stock.find((item) => item.warehouseId === warehouse.id && item.productId === existing?.id);
        return [warehouse.id, String(row?.quantityOnHand ?? 0)];
      }),
    ),
  );
  const [breaks, setBreaks] = useState<BreakDraft[]>(() =>
    (catalog.quantityBreaks ?? [])
      .filter((item) => item.productId === existing?.id)
      .map((item) => ({
        name: item.name,
        minQuantity: String(item.minQuantity),
        maxQuantity: item.maxQuantity == null ? '' : String(item.maxQuantity),
        adjustmentKind: item.adjustmentKind,
        adjustmentValue: String(item.adjustmentValue),
      })),
  );
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const taxCategories = [...new Set(catalog.products.map((item) => item.taxCategory).filter((item): item is string => Boolean(item)))];
  const taxListId = `tax-categories-${existing?.id ?? 'new'}`;

  if (!canWrite) return null;

  return (
    <form
      className={`grid gap-3 ${compact ? '' : 'rounded-lg border border-edge p-4'} md:grid-cols-3`}
      onSubmit={(event) => {
        event.preventDefault();
        if (!accessToken) return;
        setBusy(true);
        setError(undefined);
        const stock = catalog.warehouses.map((warehouse) => ({
          warehouseId: warehouse.id,
          quantityOnHand: Number(stockByWarehouse[warehouse.id] ?? 0),
        }));
        void upsertProduct(
          {
            id: existing?.id,
            sku,
            name,
            category,
            listPrice: Number(listPrice),
            cost: Number(cost),
            billingType,
            billingFrequency: billingType === 'recurring' ? (billingFrequency as Product['billingFrequency']) || 'monthly' : null,
            description: description || null,
            taxCategory: taxCategory || null,
            taxRatePercent: taxRatePercent === '' ? null : Number(taxRatePercent),
            active,
            stock: catalog.warehouses.length ? stock : undefined,
            quantityBreaks: (() => {
              const mapped = breaks
                .filter((item) => item.name.trim() && item.minQuantity)
                .map((item) => ({
                  name: item.name.trim(),
                  minQuantity: Number(item.minQuantity),
                  maxQuantity: item.maxQuantity === '' ? null : Number(item.maxQuantity),
                  adjustmentKind: canWritePolicies ? item.adjustmentKind : ('fixed' as const),
                  adjustmentValue: Number(item.adjustmentValue),
                }));
              const existingHasPercent = (catalog.quantityBreaks ?? []).some(
                (item) => item.productId === existing?.id && item.adjustmentKind === 'percent',
              );
              if (!canWritePolicies && existingHasPercent) return undefined;
              return mapped.length || existing ? mapped : undefined;
            })(),
          },
          accessToken,
        )
          .then(async (saved) => {
            toast({ title: existing ? 'Product updated successfully.' : 'Product created successfully.', variant: 'success' });
            if (!existing) {
              setSku('');
              setName('');
              setDescription('');
            }
            await onSaved(saved);
          })
          .catch((caught: unknown) => {
            const message = getApiErrorMessage(caught, 'Product could not be saved');
            setError(message);
            toast({ title: message, variant: 'error' });
          })
          .finally(() => setBusy(false));
      }}
    >
      <p className="md:col-span-3 text-sm font-medium">{existing ? `Edit ${existing.sku}` : 'Add new product'}</p>
      <p className="md:col-span-3 text-caption text-foreground-muted">
        {canWritePolicies
          ? 'Discount ceilings stay in Product Policies. Role authority remains 5% / 10% / 15% unless an admin changes it.'
          : 'Sales Representatives can create SKUs and stock. Discount policy and approval chains stay under Admin configuration.'}
      </p>
      {error ? (
        <div className="md:col-span-3">
          <Alert variant="error">{error}</Alert>
        </div>
      ) : null}
      <Input label="Product name" value={name} onChange={(event) => setName(event.target.value)} required />
      <Input label="SKU" value={sku} onChange={(event) => setSku(event.target.value)} required />
      <Input label="Category" value={category} onChange={(event) => setCategory(event.target.value)} required />
      <div className="md:col-span-3">
        <Input label="Description" value={description} onChange={(event) => setDescription(event.target.value)} />
      </div>
      <Select
        label="Product type"
        value={billingType}
        onChange={(event) => setBillingType(event.target.value as Product['billingType'])}
        options={[
          { value: 'one_time', label: 'One-time' },
          { value: 'recurring', label: 'Subscription' },
        ]}
      />
      {billingType === 'recurring' ? (
        <Select
          label="Billing frequency"
          value={billingFrequency || 'monthly'}
          onChange={(event) => setBillingFrequency(event.target.value)}
          options={[
            { value: 'monthly', label: 'Monthly' },
            { value: 'quarterly', label: 'Quarterly' },
            { value: 'yearly', label: 'Yearly' },
          ]}
        />
      ) : (
        <p className="self-end text-caption text-foreground-muted">One-time SKUs have no billing frequency.</p>
      )}
      <Input label="Currency" value="USD" disabled hint="Display currency. Stored prices use the existing catalog money fields." />
      <Select
        label="Status"
        value={active ? 'yes' : 'no'}
        onChange={(event) => setActive(event.target.value === 'yes')}
        options={[
          { value: 'yes', label: 'Active' },
          { value: 'no', label: 'Inactive' },
        ]}
      />
      <Input
        label={billingType === 'recurring' ? 'Recurring price' : 'One-time price'}
        type="number"
        min={0}
        step="0.01"
        value={listPrice}
        onChange={(event) => setListPrice(event.target.value)}
        required
      />
      <Input label="Cost" type="number" min={0} step="0.01" value={cost} onChange={(event) => setCost(event.target.value)} />
      <div>
        <Input
          label="Tax category"
          value={taxCategory}
          onChange={(event) => setTaxCategory(event.target.value)}
          list={taxListId}
          placeholder="Existing tax category"
          hint="References the catalog tax label already used on other SKUs. Tax rules stay in Admin settings."
        />
        <datalist id={taxListId}>
          {taxCategories.map((item) => (
            <option key={item} value={item} />
          ))}
        </datalist>
      </div>
      <Input
        label="Tax rate %"
        type="number"
        min={0}
        max={100}
        step="0.01"
        value={taxRatePercent}
        onChange={(event) => setTaxRatePercent(event.target.value)}
      />
      {catalog.warehouses.length ? (
        <div className="md:col-span-3 grid gap-3 md:grid-cols-3">
          <p className="md:col-span-3 text-sm font-medium">Inventory</p>
          {catalog.warehouses.map((warehouse) => (
            <Input
              key={warehouse.id}
              label={`${warehouse.name} on hand`}
              type="number"
              min={0}
              value={stockByWarehouse[warehouse.id] ?? '0'}
              onChange={(event) => setStockByWarehouse((current) => ({ ...current, [warehouse.id]: event.target.value }))}
            />
          ))}
        </div>
      ) : null}
      <div className="md:col-span-3 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium">Quantity breaks</p>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() =>
              setBreaks((current) => [
                ...current,
                { name: '', minQuantity: '10', maxQuantity: '', adjustmentKind: 'fixed', adjustmentValue: listPrice },
              ])
            }
          >
            Add break
          </Button>
        </div>
        {breaks.map((item, index) => (
          <div key={index} className="grid gap-3 rounded-lg border border-edge p-3 md:grid-cols-5">
            <Input
              label="Rule name"
              value={item.name}
              onChange={(event) =>
                setBreaks((current) => current.map((row, idx) => (idx === index ? { ...row, name: event.target.value } : row)))
              }
            />
            <Input
              label="Min qty"
              type="number"
              min={1}
              value={item.minQuantity}
              onChange={(event) =>
                setBreaks((current) => current.map((row, idx) => (idx === index ? { ...row, minQuantity: event.target.value } : row)))
              }
            />
            <Input
              label="Max qty"
              type="number"
              min={1}
              value={item.maxQuantity}
              onChange={(event) =>
                setBreaks((current) => current.map((row, idx) => (idx === index ? { ...row, maxQuantity: event.target.value } : row)))
              }
            />
            <Select
              label="Mode"
              value={item.adjustmentKind}
              onChange={(event) =>
                setBreaks((current) =>
                  current.map((row, idx) =>
                    idx === index ? { ...row, adjustmentKind: event.target.value as BreakDraft['adjustmentKind'] } : row,
                  ),
                )
              }
              options={
                canWritePolicies
                  ? [
                      { value: 'fixed', label: 'Fixed unit price' },
                      { value: 'percent', label: 'Percent off' },
                    ]
                  : [{ value: 'fixed', label: 'Fixed unit price' }]
              }
            />
            <div className="flex items-end gap-2">
              <Input
                label="Value"
                type="number"
                value={item.adjustmentValue}
                onChange={(event) =>
                  setBreaks((current) =>
                    current.map((row, idx) => (idx === index ? { ...row, adjustmentValue: event.target.value } : row)),
                  )
                }
              />
              <Button type="button" variant="ghost" onClick={() => setBreaks((current) => current.filter((_, idx) => idx !== index))}>
                Remove
              </Button>
            </div>
          </div>
        ))}
      </div>
      <div className="md:col-span-3">
        <Button type="submit" loading={busy} disabled={!accessToken}>
          {existing ? 'Save product' : 'Create product'}
        </Button>
      </div>
    </form>
  );
}

export function StockEditor({
  catalog,
  onSaved,
  existing,
}: {
  catalog: DealflowCatalog;
  onSaved: () => Promise<void> | void;
  existing?: StockLevel;
}) {
  const { accessToken, user } = useAuth();
  const { toast } = useToast();
  const canWrite = canWriteDealflowProducts(user);
  const [warehouseId, setWarehouseId] = useState(existing?.warehouseId ?? catalog.warehouses[0]?.id ?? '');
  const [productId, setProductId] = useState(existing?.productId ?? catalog.products[0]?.id ?? '');
  const [quantityOnHand, setQuantityOnHand] = useState(String(existing?.quantityOnHand ?? 0));
  const [incoming, setIncoming] = useState(String(existing?.incoming ?? 0));
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  if (!canWrite || !catalog.warehouses.length || !catalog.products.length) return null;

  return (
    <form
      className="grid gap-3 rounded-lg border border-edge p-4 md:grid-cols-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!accessToken) return;
        setBusy(true);
        setError(undefined);
        void upsertStock(
          { warehouseId, productId, quantityOnHand: Number(quantityOnHand), reserved: 0, incoming: Number(incoming) },
          accessToken,
        )
          .then(async () => {
            toast({ title: 'Stock updated', variant: 'success' });
            await onSaved();
          })
          .catch((caught: unknown) => {
            const message = getApiErrorMessage(caught, 'Stock could not be saved');
            setError(message);
            toast({ title: message, variant: 'error' });
          })
          .finally(() => setBusy(false));
      }}
    >
      <p className="md:col-span-4 text-sm font-medium">{existing ? 'Edit stock position' : 'Update stock'}</p>
      {error ? <Alert variant="error">{error}</Alert> : null}
      <Select
        label="Warehouse"
        value={warehouseId}
        onChange={(event) => setWarehouseId(event.target.value)}
        options={catalog.warehouses.map((item) => ({ value: item.id, label: item.name }))}
      />
      <Select
        label="Product"
        value={productId}
        onChange={(event) => setProductId(event.target.value)}
        options={catalog.products.map((item) => ({ value: item.id, label: `${item.sku} · ${item.name}` }))}
      />
      <Input label="On hand" type="number" min={0} value={quantityOnHand} onChange={(event) => setQuantityOnHand(event.target.value)} />
      <Input label="Incoming" type="number" min={0} value={incoming} onChange={(event) => setIncoming(event.target.value)} />
      <div className="md:col-span-4">
        <Button type="submit" loading={busy} disabled={!accessToken}>
          Save stock
        </Button>
      </div>
    </form>
  );
}

export function PolicyEditor({
  onSaved,
  existing,
}: {
  catalog: DealflowCatalog;
  onSaved: () => Promise<void> | void;
  existing?: DiscountPolicy;
}) {
  const { accessToken, user } = useAuth();
  const { toast } = useToast();
  const canWrite = hasPermission(user, 'dealflow.catalog.write');
  const [name, setName] = useState(existing?.name ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [customerTier, setCustomerTier] = useState(existing?.customerTier ?? '');
  const [productCategory, setProductCategory] = useState(existing?.productCategory ?? '');
  const [warningPercent, setWarningPercent] = useState(String(existing?.warningPercent ?? 3));
  const [approvalPercent, setApprovalPercent] = useState(String(existing?.approvalPercent ?? 5));
  const [rejectPercent, setRejectPercent] = useState(String(existing?.rejectPercent ?? 25));
  const [maxMarginImpactPercent, setMaxMarginImpactPercent] = useState(String(existing?.maxMarginImpactPercent ?? 40));
  const [priority, setPriority] = useState(String(existing?.priority ?? 100));
  const [active, setActive] = useState(existing?.active !== false);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  if (!canWrite) return null;

  return (
    <form
      className="grid gap-3 rounded-lg border border-edge p-4 md:grid-cols-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!accessToken) return;
        setBusy(true);
        setError(undefined);
        void upsertPolicy(
          {
            id: existing?.id,
            name,
            description: description || null,
            customerTier: (customerTier || null) as DiscountPolicy['customerTier'],
            productCategory: productCategory || null,
            warningPercent: Number(warningPercent),
            approvalPercent: Number(approvalPercent),
            rejectPercent: Number(rejectPercent),
            maxMarginImpactPercent: Number(maxMarginImpactPercent),
            priority: Number(priority),
            active,
          },
          accessToken,
        )
          .then(async () => {
            toast({ title: existing ? 'Policy updated' : 'Policy created', variant: 'success' });
            await onSaved();
          })
          .catch((caught: unknown) => {
            const message = getApiErrorMessage(caught, 'Policy could not be saved');
            setError(message);
            toast({ title: message, variant: 'error' });
          })
          .finally(() => setBusy(false));
      }}
    >
      <p className="md:col-span-3 text-sm font-medium">{existing ? `Edit ${existing.name}` : 'Create discount policy'}</p>
      {error ? <Alert variant="error">{error}</Alert> : null}
      <Input label="Name" value={name} onChange={(event) => setName(event.target.value)} required />
      <Input label="Description" value={description} onChange={(event) => setDescription(event.target.value)} />
      <Select
        label="Loyalty tier"
        value={customerTier}
        onChange={(event) => setCustomerTier(event.target.value)}
        options={[
          { value: '', label: 'Any' },
          { value: 'gold', label: 'Gold' },
          { value: 'platinum', label: 'Platinum' },
        ]}
      />
      <Input label="Product category" value={productCategory} onChange={(event) => setProductCategory(event.target.value)} />
      <Input label="Warning %" type="number" value={warningPercent} onChange={(event) => setWarningPercent(event.target.value)} />
      <Input label="Approval %" type="number" value={approvalPercent} onChange={(event) => setApprovalPercent(event.target.value)} />
      <Input label="Reject %" type="number" value={rejectPercent} onChange={(event) => setRejectPercent(event.target.value)} />
      <Input label="Max margin impact %" type="number" value={maxMarginImpactPercent} onChange={(event) => setMaxMarginImpactPercent(event.target.value)} />
      <Input label="Priority" type="number" value={priority} onChange={(event) => setPriority(event.target.value)} />
      <Select
        label="Active"
        value={active ? 'yes' : 'no'}
        onChange={(event) => setActive(event.target.value === 'yes')}
        options={[
          { value: 'yes', label: 'Active' },
          { value: 'no', label: 'Inactive' },
        ]}
      />
      <div className="md:col-span-3">
        <Button type="submit" loading={busy} disabled={!accessToken}>
          {existing ? 'Save policy' : 'Create policy'}
        </Button>
      </div>
    </form>
  );
}

export function ChainEditor({
  onSaved,
  existing,
}: {
  catalog?: DealflowCatalog;
  onSaved: () => Promise<void> | void;
  existing?: ApprovalChain;
}) {
  const { accessToken, user } = useAuth();
  const { toast } = useToast();
  const canWrite = hasPermission(user, 'dealflow.catalog.write');
  const [name, setName] = useState(existing?.name ?? '');
  const [minRiskScore, setMinRiskScore] = useState(String(existing?.minRiskScore ?? 0));
  const [minBlendedDiscountPercent, setMinBlended] = useState(String(existing?.minBlendedDiscountPercent ?? 5));
  const [priority, setPriority] = useState(String(existing?.priority ?? 30));
  const [steps, setSteps] = useState(
    existing?.steps?.length
      ? existing.steps
      : [{ id: crypto.randomUUID(), chainId: existing?.id ?? '', stepOrder: 1, roleKey: 'manager' as const, label: 'Manager' }],
  );
  const [active, setActive] = useState(existing?.active !== false);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  if (!canWrite) return null;

  return (
    <form
      className="grid gap-3 rounded-lg border border-edge p-4 md:grid-cols-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!accessToken) return;
        setBusy(true);
        setError(undefined);
        const id = existing?.id ?? crypto.randomUUID();
        void upsertChain(
          {
            id,
            name,
            minRiskScore: Number(minRiskScore),
            minBlendedDiscountPercent: Number(minBlendedDiscountPercent),
            priority: Number(priority),
            active,
            steps: steps.map((step, index) => ({
              ...step,
              id: step.id || crypto.randomUUID(),
              chainId: id,
              stepOrder: index + 1,
            })),
          },
          accessToken,
        )
          .then(async () => {
            toast({ title: existing ? 'Chain updated' : 'Chain created', variant: 'success' });
            await onSaved();
          })
          .catch((caught: unknown) => {
            const message = getApiErrorMessage(caught, 'Approval chain could not be saved');
            setError(message);
            toast({ title: message, variant: 'error' });
          })
          .finally(() => setBusy(false));
      }}
    >
      <p className="md:col-span-3 text-sm font-medium">{existing ? `Edit ${existing.name}` : 'Create approval chain'}</p>
      {error ? <Alert variant="error">{error}</Alert> : null}
      <Input label="Name" value={name} onChange={(event) => setName(event.target.value)} required />
      <Input label="Min risk" type="number" value={minRiskScore} onChange={(event) => setMinRiskScore(event.target.value)} />
      <Input label="Min blended %" type="number" value={minBlendedDiscountPercent} onChange={(event) => setMinBlended(event.target.value)} />
      <Input label="Priority" type="number" value={priority} onChange={(event) => setPriority(event.target.value)} />
      <Select
        label="Active"
        value={active ? 'yes' : 'no'}
        onChange={(event) => setActive(event.target.value === 'yes')}
        options={[
          { value: 'yes', label: 'Active' },
          { value: 'no', label: 'Inactive' },
        ]}
      />
      {steps.map((step, index) => (
        <fieldset key={step.id || index} className="md:col-span-3 grid gap-2 rounded-lg border border-edge p-3 md:grid-cols-3">
          <Select
            label={`Step ${index + 1} role`}
            value={step.roleKey}
            onChange={(event) =>
              setSteps((current) =>
                current.map((item, idx) =>
                  idx === index ? { ...item, roleKey: event.target.value as typeof item.roleKey } : item,
                ),
              )
            }
            options={[
              { value: 'manager', label: 'Manager' },
              { value: 'finance', label: 'Finance' },
              { value: 'final', label: 'Final' },
            ]}
          />
          <Input
            label="Label"
            value={step.label}
            onChange={(event) =>
              setSteps((current) => current.map((item, idx) => (idx === index ? { ...item, label: event.target.value } : item)))
            }
          />
          <Button
            type="button"
            variant="ghost"
            onClick={() => setSteps((current) => (current.length > 1 ? current.filter((_, idx) => idx !== index) : current))}
          >
            Remove step
          </Button>
        </fieldset>
      ))}
      <div className="md:col-span-3 flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            setSteps((current) =>
              current.length >= 3
                ? current
                : [...current, { id: crypto.randomUUID(), chainId: existing?.id ?? '', stepOrder: current.length + 1, roleKey: 'finance', label: 'Finance' }],
            )
          }
        >
          Add step
        </Button>
        <Button type="submit" loading={busy} disabled={!accessToken}>
          {existing ? 'Save chain' : 'Create chain'}
        </Button>
      </div>
    </form>
  );
}

export function canManageDealflowCustomers(user: { permissions?: string[] } | null | undefined) {
  return hasPermission(user, 'dealflow.quotes.write') || hasPermission(user, 'dealflow.catalog.write');
}

export function CustomerEditor({
  onSaved,
  existing,
}: {
  onSaved: () => Promise<void> | void;
  existing?: Customer;
}) {
  const { accessToken, user } = useAuth();
  const { toast } = useToast();
  const canWrite = canManageDealflowCustomers(user);
  const [name, setName] = useState(existing?.name ?? '');
  const [email, setEmail] = useState(existing?.email ?? '');
  const [tier, setTier] = useState<Customer['tier']>(existing?.tier ?? 'standard');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  if (!canWrite) return null;

  return (
    <form
      className="grid gap-3 md:grid-cols-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!accessToken) return;
        setBusy(true);
        setError(undefined);
        void upsertCustomer({ id: existing?.id, name, email, tier }, accessToken)
          .then(async () => {
            toast({ title: existing ? 'Customer updated' : 'Customer created', variant: 'success' });
            await onSaved();
          })
          .catch((caught: unknown) => {
            const message = getApiErrorMessage(caught, 'Customer could not be saved');
            setError(message);
            toast({ title: message, variant: 'error' });
          })
          .finally(() => setBusy(false));
      }}
    >
      <p className="md:col-span-3 text-sm font-medium">{existing ? `Edit ${existing.name}` : 'Add customer / contact'}</p>
      {error ? <Alert variant="error">{error}</Alert> : null}
      <Input label="Company / contact name" value={name} onChange={(event) => setName(event.target.value)} required />
      <Input label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
      <Select
        label="Tier"
        value={tier}
        onChange={(event) => setTier(event.target.value as Customer['tier'])}
        options={[
          { value: 'standard', label: 'Standard' },
          { value: 'silver', label: 'Silver' },
          { value: 'gold', label: 'Gold' },
          { value: 'strategic', label: 'Strategic' },
          { value: 'platinum', label: 'Platinum' },
        ]}
      />
      <div className="md:col-span-3">
        <Button type="submit" loading={busy} disabled={!accessToken}>
          {existing ? 'Save customer' : 'Create customer'}
        </Button>
      </div>
    </form>
  );
}

export function WarehouseEditor({
  onSaved,
  existing,
}: {
  onSaved: () => Promise<void> | void;
  existing?: Warehouse;
}) {
  const { accessToken, user } = useAuth();
  const { toast } = useToast();
  const canWrite = hasPermission(user, 'dealflow.catalog.write');
  const [name, setName] = useState(existing?.name ?? '');
  const [cost, setCost] = useState(String(existing?.fulfillmentCostPerUnit ?? 0));
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  if (!canWrite) return null;

  return (
    <form
      className="grid gap-3 md:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (!accessToken) return;
        setBusy(true);
        setError(undefined);
        void upsertWarehouse({ id: existing?.id, name, fulfillmentCostPerUnit: Number(cost) }, accessToken)
          .then(async () => {
            toast({ title: existing ? 'Warehouse updated' : 'Warehouse created', variant: 'success' });
            await onSaved();
          })
          .catch((caught: unknown) => {
            const message = getApiErrorMessage(caught, 'Warehouse could not be saved');
            setError(message);
            toast({ title: message, variant: 'error' });
          })
          .finally(() => setBusy(false));
      }}
    >
      <p className="md:col-span-2 text-sm font-medium">{existing ? `Edit ${existing.name}` : 'Add warehouse'}</p>
      {error ? <Alert variant="error">{error}</Alert> : null}
      <Input label="Name" value={name} onChange={(event) => setName(event.target.value)} required />
      <Input label="Fulfillment cost / unit" type="number" min={0} value={cost} onChange={(event) => setCost(event.target.value)} />
      <div className="md:col-span-2">
        <Button type="submit" loading={busy} disabled={!accessToken}>
          {existing ? 'Save warehouse' : 'Create warehouse'}
        </Button>
      </div>
    </form>
  );
}

export function RelationEditor({
  catalog,
  onSaved,
  existing,
}: {
  catalog: DealflowCatalog;
  onSaved: () => Promise<void> | void;
  existing?: ProductRelation;
}) {
  const { accessToken, user } = useAuth();
  const { toast } = useToast();
  const canWrite = hasPermission(user, 'dealflow.catalog.write');
  const [productId, setProductId] = useState(existing?.productId ?? catalog.products[0]?.id ?? '');
  const [recommendedProductId, setRecommended] = useState(existing?.recommendedProductId ?? catalog.products[1]?.id ?? catalog.products[0]?.id ?? '');
  const [kind, setKind] = useState<ProductRelation['kind']>(existing?.kind ?? 'cross_sell');
  const [reason, setReason] = useState(existing?.reason ?? '');
  const [promotion, setPromotion] = useState(existing?.promotion ?? '');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  if (!canWrite || catalog.products.length < 2) return null;

  return (
    <form
      className="grid gap-3 md:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (!accessToken) return;
        setBusy(true);
        setError(undefined);
        void upsertRelation(
          {
            id: existing?.id,
            productId,
            recommendedProductId,
            kind,
            reason,
            promotion: promotion || null,
            minQuantity: existing?.minQuantity ?? 1,
          },
          accessToken,
        )
          .then(async () => {
            toast({ title: existing ? 'Recommendation updated' : 'Recommendation created', variant: 'success' });
            await onSaved();
          })
          .catch((caught: unknown) => {
            const message = getApiErrorMessage(caught, 'Recommendation could not be saved');
            setError(message);
            toast({ title: message, variant: 'error' });
          })
          .finally(() => setBusy(false));
      }}
    >
      <p className="md:col-span-2 text-sm font-medium">{existing ? 'Edit recommendation' : 'Add recommendation'}</p>
      {error ? <Alert variant="error">{error}</Alert> : null}
      <Select
        label="Source product"
        value={productId}
        onChange={(event) => setProductId(event.target.value)}
        options={catalog.products.map((item) => ({ value: item.id, label: `${item.sku} · ${item.name}` }))}
      />
      <Select
        label="Recommended product"
        value={recommendedProductId}
        onChange={(event) => setRecommended(event.target.value)}
        options={catalog.products.map((item) => ({ value: item.id, label: `${item.sku} · ${item.name}` }))}
      />
      <Select
        label="Kind"
        value={kind}
        onChange={(event) => setKind(event.target.value as ProductRelation['kind'])}
        options={[
          { value: 'cross_sell', label: 'Cross-sell' },
          { value: 'upsell', label: 'Upsell' },
        ]}
      />
      <Input label="Promotion" value={promotion} onChange={(event) => setPromotion(event.target.value)} />
      <Input label="Reason" value={reason} onChange={(event) => setReason(event.target.value)} required />
      <div className="md:col-span-2">
        <Button type="submit" loading={busy} disabled={!accessToken}>
          {existing ? 'Save recommendation' : 'Create recommendation'}
        </Button>
      </div>
    </form>
  );
}
