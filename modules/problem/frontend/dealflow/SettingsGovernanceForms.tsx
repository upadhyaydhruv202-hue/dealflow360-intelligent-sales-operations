import { useEffect, useState } from 'react';

import { useAuth } from '@/auth/AuthProvider';
import { hasPermission } from '@/lib/rbac';
import { getApiErrorMessage } from '@/services/api';
import { Alert, Button, Input, Select, useToast } from '@/ui';

import { replaceQuantityBreaks, replaceRoleAuthorities, updateGovernance } from './api';
import { formatMoney } from './format';
import type { DealflowCatalog, GovernanceSettings, Product, QuantityBreak, RoleAuthority } from './types';

export function QuantityBreakEditor({
  catalog,
  onSaved,
}: {
  catalog: DealflowCatalog;
  onSaved: () => Promise<void>;
}) {
  const { accessToken, user } = useAuth();
  const { toast } = useToast();
  const canWrite = hasPermission(user, 'dealflow.catalog.write');
  const [items, setItems] = useState<QuantityBreak[]>(catalog.quantityBreaks ?? []);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setItems(catalog.quantityBreaks ?? []);
  }, [catalog.quantityBreaks]);

  if (!canWrite) {
    return <p className="text-caption text-foreground-muted">Only configuration users can edit quantity breaks.</p>;
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!accessToken) return;
        setBusy(true);
        setError(undefined);
        void replaceQuantityBreaks(items, accessToken)
          .then(async () => {
            toast({ title: 'Quantity breaks saved', variant: 'success' });
            await onSaved();
          })
          .catch((caught: unknown) => {
            const message = getApiErrorMessage(caught, 'Quantity breaks were rejected');
            setError(message);
            toast({ title: message, variant: 'error' });
          })
          .finally(() => setBusy(false));
      }}
    >
      {error ? <Alert variant="error">{error}</Alert> : null}
      {items.map((item, index) => (
        <fieldset key={item.id} className="grid gap-2 rounded-lg border border-edge p-3 md:grid-cols-6">
          <legend className="sr-only">{item.name || `Break ${index + 1}`}</legend>
          <Input
            label="Rule name"
            value={item.name}
            onChange={(event) => setItems(updateAt(items, index, { name: event.target.value }))}
          />
          <Select
            label="Product"
            value={item.productId}
            onChange={(event) => setItems(updateAt(items, index, { productId: event.target.value }))}
            options={catalog.products.map((product) => ({ value: product.id, label: productSku(product) }))}
          />
          <Input
            label="Min qty"
            type="number"
            min={1}
            value={String(item.minQuantity)}
            onChange={(event) => setItems(updateAt(items, index, { minQuantity: Number(event.target.value) }))}
          />
          <Input
            label="Max qty"
            type="number"
            min={1}
            value={item.maxQuantity == null ? '' : String(item.maxQuantity)}
            onChange={(event) =>
              setItems(updateAt(items, index, { maxQuantity: event.target.value === '' ? null : Number(event.target.value) }))
            }
          />
          <Select
            label="Mode"
            value={item.adjustmentKind}
            onChange={(event) =>
              setItems(updateAt(items, index, { adjustmentKind: event.target.value as QuantityBreak['adjustmentKind'] }))
            }
            options={[
              { value: 'fixed', label: 'Fixed price' },
              { value: 'percent', label: 'Percent of list' },
            ]}
          />
          <Input
            label={item.adjustmentKind === 'percent' ? 'Percent' : 'Price'}
            type="number"
            value={String(item.adjustmentValue)}
            onChange={(event) => setItems(updateAt(items, index, { adjustmentValue: Number(event.target.value) }))}
          />
          <Select
            label="Active"
            value={item.active === false ? 'false' : 'true'}
            onChange={(event) => setItems(updateAt(items, index, { active: event.target.value === 'true' }))}
            options={[
              { value: 'true', label: 'Active' },
              { value: 'false', label: 'Inactive' },
            ]}
          />
        </fieldset>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            setItems([
              ...items,
              {
                id: crypto.randomUUID(),
                name: 'New quantity break',
                productId: catalog.products[0]?.id ?? '',
                minQuantity: 1,
                maxQuantity: null,
                adjustmentKind: 'fixed',
                adjustmentValue: catalog.products[0]?.listPrice ?? 0,
                active: true,
              },
            ])
          }
        >
          Add break
        </Button>
        <Button type="submit" loading={busy}>
          Save quantity breaks
        </Button>
      </div>
    </form>
  );
}

export function RoleAuthorityEditor({
  catalog,
  onSaved,
}: {
  catalog: DealflowCatalog;
  onSaved: () => Promise<void>;
}) {
  const { accessToken, user } = useAuth();
  const { toast } = useToast();
  const canWrite = hasPermission(user, 'dealflow.catalog.write');
  const [items, setItems] = useState<RoleAuthority[]>(catalog.roleAuthorities ?? []);
  const [governance, setGovernance] = useState<GovernanceSettings | undefined>(catalog.governance);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setItems(catalog.roleAuthorities ?? []);
    setGovernance(catalog.governance);
  }, [catalog.governance, catalog.roleAuthorities]);

  if (!canWrite) {
    return <p className="text-caption text-foreground-muted">Only configuration users can edit role ranges.</p>;
  }

  return (
    <div className="space-y-4">
      {error ? <Alert variant="error">{error}</Alert> : null}
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (!accessToken) return;
          setBusy(true);
          setError(undefined);
          void replaceRoleAuthorities(items, accessToken)
            .then(async () => {
              toast({ title: 'Role ranges saved', variant: 'success' });
              await onSaved();
            })
            .catch((caught: unknown) => {
              const message = getApiErrorMessage(caught, 'Role ranges were rejected');
              setError(message);
              toast({ title: message, variant: 'error' });
            })
            .finally(() => setBusy(false));
        }}
      >
        {items.map((item, index) => (
          <fieldset key={item.roleKey} className="grid gap-2 rounded-lg border border-edge p-3 md:grid-cols-3">
            <legend className="px-1 text-sm font-medium">{item.roleKey}</legend>
            <Input
              label="Max discount %"
              type="number"
              min={0}
              max={100}
              value={String(item.maxDiscountPercent)}
              onChange={(event) => setItems(updateAt(items, index, { maxDiscountPercent: Number(event.target.value) }))}
            />
            <Input
              label="Min margin %"
              type="number"
              min={0}
              max={100}
              value={String(item.minMarginPercent)}
              onChange={(event) => setItems(updateAt(items, index, { minMarginPercent: Number(event.target.value) }))}
            />
            <Input
              label="Max price override %"
              type="number"
              min={0}
              max={100}
              value={String(item.maxPriceOverridePercent)}
              onChange={(event) => setItems(updateAt(items, index, { maxPriceOverridePercent: Number(event.target.value) }))}
            />
            <Select
              label="If exceeded"
              value={item.exceedAction}
              onChange={(event) =>
                setItems(updateAt(items, index, { exceedAction: event.target.value as RoleAuthority['exceedAction'] }))
              }
              options={[
                { value: 'approval', label: 'Require approval' },
                { value: 'block', label: 'Block' },
                { value: 'allow', label: 'Allow' },
              ]}
            />
            <Select
              label="Can negotiate"
              value={item.canNegotiate ? 'true' : 'false'}
              onChange={(event) => setItems(updateAt(items, index, { canNegotiate: event.target.value === 'true' }))}
              options={[
                { value: 'true', label: 'Yes' },
                { value: 'false', label: 'No' },
              ]}
            />
          </fieldset>
        ))}
        <Button type="submit" loading={busy}>
          Save role ranges
        </Button>
      </form>
      {governance ? (
        <form
          className="grid gap-3 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!accessToken) return;
            setBusy(true);
            setError(undefined);
            void updateGovernance(governance, accessToken)
              .then(async () => {
                toast({ title: 'Governance saved', variant: 'success' });
                await onSaved();
              })
              .catch((caught: unknown) => {
                const message = getApiErrorMessage(caught, 'Governance was rejected');
                setError(message);
                toast({ title: message, variant: 'error' });
              })
              .finally(() => setBusy(false));
          }}
        >
          <Input
            label="High-value net threshold"
            type="number"
            min={0}
            value={String(governance.highValueNetTotal)}
            onChange={(event) => setGovernance({ ...governance, highValueNetTotal: Number(event.target.value) })}
          />
          <Input
            label="Max approval levels (1–3)"
            type="number"
            min={1}
            max={3}
            value={String(governance.maxApprovalLevels)}
            onChange={(event) => setGovernance({ ...governance, maxApprovalLevels: Number(event.target.value) })}
          />
          <Input
            label="Material discount Δ (pp)"
            type="number"
            min={0}
            value={String(governance.materialDiscountDeltaPp)}
            onChange={(event) => setGovernance({ ...governance, materialDiscountDeltaPp: Number(event.target.value) })}
          />
          <Input
            label="Cumulative warning limit"
            type="number"
            min={1}
            value={String(governance.cumulativeWarningLimit)}
            onChange={(event) => setGovernance({ ...governance, cumulativeWarningLimit: Number(event.target.value) })}
          />
          <Input
            label="Tax rate %"
            type="number"
            min={0}
            max={100}
            value={String(governance.taxRatePercent ?? 0)}
            onChange={(event) => setGovernance({ ...governance, taxRatePercent: Number(event.target.value) })}
          />
          <Input
            label="Stale quote days"
            type="number"
            min={1}
            value={String(governance.staleQuoteDays ?? 7)}
            onChange={(event) => setGovernance({ ...governance, staleQuoteDays: Number(event.target.value) })}
          />
          <Input
            label="Unusual discount %"
            type="number"
            min={0}
            max={100}
            value={String(governance.unusualDiscountPercent ?? 25)}
            onChange={(event) => setGovernance({ ...governance, unusualDiscountPercent: Number(event.target.value) })}
          />
          <Input
            label="Large-deal net threshold"
            type="number"
            min={0}
            value={String(governance.largeDealNetTotal ?? 50000)}
            onChange={(event) => setGovernance({ ...governance, largeDealNetTotal: Number(event.target.value) })}
          />
          <div className="md:col-span-2">
            <Button type="submit" loading={busy}>
              Save governance
            </Button>
            <p className="mt-2 text-caption text-foreground-muted">
              Current high-value threshold {formatMoney(governance.highValueNetTotal, true)}. Admin is not inserted into
              chains.
            </p>
          </div>
        </form>
      ) : null}
    </div>
  );
}

function productSku(product: Product) {
  return `${product.sku} · ${product.name}`;
}

function updateAt<T>(items: T[], index: number, patch: Partial<T>): T[] {
  return items.map((item, current) => (current === index ? { ...item, ...patch } : item));
}
