import { MoreHorizontal } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';

import { useAuth } from '@/auth/AuthProvider';
import { hasPermission } from '@/lib/rbac';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  LoadingState,
  Modal,
  Select,
  Dropdown,
} from '@/ui';

import { createQuote } from './api';
import {
  approvalTone,
  availableUnits,
  incomingUnits,
  decisionTone,
  formatDate,
  formatMoney,
  formatPercent,
  riskLabel,
  roleLabel,
  statusLabel,
  statusTone,
} from './format';
import type { DealHealthSummary } from './intelligence';
import { healthTone } from './intelligence';
import type {
  ApprovalRoleKey,
  DealflowCatalog,
  DiscountPolicy,
  LineAssessment,
  QuoteApproval,
  QuoteView,
} from './types';

export function StatusCards({
  items,
}: {
  items: Array<{ id: string; label: string; value: number; onClick?: () => void; active?: boolean }>;
}) {
  return (
    <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={item.onClick}
          className={`rounded-lg border px-4 py-3 text-left transition-colors duration-df ${
            item.active ? 'border-foreground bg-surface-muted' : 'border-edge hover:border-foreground/30'
          }`}
        >
          <p className="text-caption uppercase tracking-[0.12em] text-foreground-muted">{item.label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight">{item.value}</p>
        </button>
      ))}
    </div>
  );
}

export function RelatedDealLinks({ quoteId, portalToken }: { quoteId: string; portalToken?: string }) {
  const links = [
    { to: `/dealflow/quotes/${quoteId}`, label: 'Workspace' },
    { to: `/dealflow/approvals/${quoteId}`, label: 'Approval detail' },
    { to: `/dealflow/fulfillment/${quoteId}`, label: 'Fulfillment' },
    { to: `/dealflow/subscriptions/${quoteId}`, label: 'Subscriptions' },
    { to: `/dealflow/invoices/${quoteId}`, label: 'Invoices' },
    portalToken ? { to: `/portal/${encodeURIComponent(portalToken)}`, label: 'Customer portal' } : null,
  ].filter(Boolean) as Array<{ to: string; label: string }>;

  return (
    <nav aria-label="Related deal screens" className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
      {links.map((item) => (
        <Link key={item.to} className="font-medium hover:underline" to={item.to}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export function DealflowGate({
  permission,
  children,
}: {
  permission: string;
  children: React.ReactNode;
}) {
  const { user, isAuthenticated, ready } = useAuth();
  if (!ready) {
    return <LoadingState label="Restoring session…" />;
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return hasPermission(user, permission) ? children : <Navigate to="/account" replace />;
}

export function StatusBadge({ status }: { status: QuoteView['status'] }) {
  return <Badge tone={statusTone(status)}>{statusLabel(status)}</Badge>;
}

export function DecisionBadge({ decision }: { decision: QuoteView['assessmentDecision'] }) {
  return <Badge tone={decisionTone(decision)}>{decision.replaceAll('_', ' ')}</Badge>;
}

export function HealthBadge({ health }: { health: DealHealthSummary }) {
  return (
    <Badge tone={healthTone(health.level)}>
      {health.level} · {health.score}
    </Badge>
  );
}

export function policyForLine(policies: DiscountPolicy[], assessment?: LineAssessment): DiscountPolicy | undefined {
  return policies.find((policy) => policy.id === assessment?.policyId);
}

export function RiskPanel({
  quote,
  policies,
}: {
  quote: QuoteView;
  policies: DiscountPolicy[];
}) {
  const assessment = quote.assessment;
  const lines = assessment?.lines ?? [];
  const risky = lines.filter((line) => line.decision !== 'allowed');
  const headline = riskLabel(quote);
  const who = quote.assessment?.requiredChainName;

  return (
    <Card className="border-l-4 border-l-danger">
      <CardHeader>
        <div>
          <CardTitle className="text-base tracking-wide">{headline}</CardTitle>
          <CardDescription>
            Blended discount {formatPercent(quote.blendedDiscountPercent)} · Backend risk {quote.riskScore}
          </CardDescription>
        </div>
        <DecisionBadge decision={quote.assessmentDecision} />
      </CardHeader>
      <div className="mb-4 space-y-2 text-sm">
        <p className="text-foreground">
          {quote.assessmentDecision === 'allowed'
            ? 'Discounts sit inside policy ceilings. No approval chain is required.'
            : who
              ? `Approval: ${who}`
              : 'The backend assessment requires review before this quote can proceed.'}
        </p>
        {assessment?.reasons.slice(0, 4).map((reason) => (
          <p key={reason}>
            <span className="font-semibold">Why: </span>
            {reason}
          </p>
        ))}
        {assessment?.highValue ? (
          <Alert variant="warning" title="High-value approval required">
            Net total meets the configured high-value threshold. Admin is not inserted unless a chain step says so.
          </Alert>
        ) : null}
        {assessment?.mergeRisk ? (
          <Alert variant="warning" title="Approval merge risk">
            {assessment.mergeRiskReasons?.[0] ??
              'Multiple product lines require review and stay itemized on this quote chain.'}
          </Alert>
        ) : null}
      </div>
      <div className="space-y-3">
        {(risky.length ? risky : lines).map((line) => {
          const policy = policyForLine(policies, line);
          const allowed = policy?.approvalPercent;
          const delta = allowed == null ? null : line.discountPercent - allowed;
          const productName =
            quote.lines.find((item) => item.id === line.lineId)?.product?.name ??
            quote.lines.find((item) => item.productId === line.productId)?.product?.name ??
            line.sku;
          return (
            <div key={line.lineId || `${line.productId}-${line.sku}-${line.quantity}`} className="rounded-lg bg-surface-muted p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{productName}</p>
                  <p className="mt-1 text-xs text-foreground-muted">{line.sku} · {line.policyName}</p>
                </div>
                <Badge tone={decisionTone(line.decision)}>{line.decision.replaceAll('_', ' ')}</Badge>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                <div>
                  <dt className="text-xs text-foreground-muted">Requested</dt>
                  <dd className="font-medium">{formatPercent(line.discountPercent)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-foreground-muted">Allowed</dt>
                  <dd className="font-medium">{allowed == null ? '—' : formatPercent(allowed)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-foreground-muted">Variance</dt>
                  <dd className="font-medium">
                    {delta == null ? '—' : `${delta > 0 ? '+' : ''}${Number(delta.toFixed(2))} pts`}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-foreground-muted">Margin</dt>
                  <dd className="font-medium">{formatPercent(line.marginPercent)}</dd>
                </div>
              </dl>
              {line.pricingRuleName ? (
                <p className="mt-2 text-xs text-foreground-muted">
                  Pricing rule {line.pricingRuleName}
                  {line.appliedPrice != null ? ` · applied ${formatMoney(line.appliedPrice, true)}` : ''}
                </p>
              ) : null}
              {line.reasons.length ? (
                <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-foreground-muted">
                  {line.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          );
        })}
      </div>
      {assessment?.cumulativeEscalated ? (
        <Alert variant="warning" className="mt-4">
          Multiple warning-level lines were escalated by the backend cumulative rule.
        </Alert>
      ) : null}
    </Card>
  );
}

export function ApprovalTimeline({ approvals }: { approvals: QuoteApproval[] }) {
  if (!approvals.length) {
    return <EmptyState title="No approval steps" description="Submit the quote to create a backend approval chain." />;
  }
  const sorted = [...approvals].sort((left, right) => left.stepOrder - right.stepOrder);
  const currentId = sorted.find((item) => item.status === 'pending')?.id;
  return (
    <ol className="space-y-3">
      {sorted.map((step, index) => (
        <li key={step.id} className="flex gap-3">
          <span className="mt-1 h-6 w-6 shrink-0 rounded-full bg-surface-muted text-center text-xs font-semibold leading-6">
            {index + 1}
          </span>
          <div
            className={`min-w-0 flex-1 rounded-lg border p-3 ${
              step.id === currentId ? 'border-accent bg-surface-muted' : 'border-edge'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-foreground">
                {step.label} · {roleLabel(step.roleKey)}
                {step.id === currentId ? ' · current' : ''}
              </p>
              <Badge tone={approvalTone(step.status)}>{step.status}</Badge>
            </div>
            <p className="mt-1 text-xs text-foreground-muted">Approver: {roleLabel(step.roleKey)}</p>
            {step.reason ? <p className="mt-1 text-xs text-foreground-muted">Reason: {step.reason}</p> : null}
            {step.decidedAt ? (
              <p className="mt-1 text-xs text-foreground-muted">Decided {formatDate(step.decidedAt)}</p>
            ) : (
              <p className="mt-1 text-xs text-foreground-muted">No decision yet</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function NegotiationStory({ quote }: { quote: QuoteView }) {
  const material = quote.revisions.some((item) => item.materialChange);
  const invalidated = quote.approvals.some((item) => item.status === 'invalidated');
  const accepted = ['confirmed', 'fulfillment', 'billing', 'completed'].includes(quote.status);
  const steps = [
    { id: 'sent', label: 'Quotation ready', active: quote.lines.length > 0 },
    { id: 'note', label: 'Customer note', active: quote.status === 'customer_negotiation' || quote.status === 'manager_review' || quote.status === 'finalized' || accepted || material },
    { id: 'review', label: 'Manager review', active: quote.status === 'manager_review' || quote.status === 'finalized' || accepted },
    { id: 'final', label: 'Frozen final', active: quote.status === 'finalized' || quote.status === 'approval_required' || quote.status === 'approved' || accepted },
    { id: 'approve', label: 'Approval', active: quote.status === 'approval_required' || quote.status === 'approved' || accepted || invalidated },
    { id: 'lock', label: 'Finance lock', active: accepted },
    { id: 'accepted', label: 'Locked', active: accepted },
  ];
  return (
    <Card>
      <CardTitle className="mb-3">Negotiation path</CardTitle>
      <ol className="grid gap-2 sm:grid-cols-3 xl:grid-cols-7">
        {steps.map((step) => (
          <li
            key={step.id}
            className={`rounded-lg border px-3 py-2 text-xs font-medium ${
              step.active ? 'border-accent bg-surface-muted text-foreground' : 'border-edge text-foreground-muted'
            }`}
          >
            {step.label}
          </li>
        ))}
      </ol>
    </Card>
  );
}

export function FulfillmentBoard({
  quote,
  catalog,
}: {
  quote: QuoteView;
  catalog?: DealflowCatalog;
}) {
  const byWarehouse = new Map<string, { quantity: number; available: number; incoming: number }>();
  for (const allocation of quote.fulfillment.allocations.filter((item) => !item.isBackorder)) {
    const line = quote.lines.find((item) => item.id === allocation.quoteLineId);
    const available = line ? availableUnits(catalog?.stock, allocation.warehouseId, line.productId) : 0;
    const incoming = line ? incomingUnits(catalog?.stock, allocation.warehouseId, line.productId) : 0;
    const current = byWarehouse.get(allocation.warehouseId) ?? { quantity: 0, available, incoming };
    current.quantity += allocation.quantity;
    current.available = Math.min(current.available || available, available);
    current.incoming = Math.max(current.incoming, incoming);
    byWarehouse.set(allocation.warehouseId, current);
  }
  const required = quote.lines.reduce((sum, line) => sum + line.quantity, 0);
  const allocated = quote.fulfillment.allocations
    .filter((item) => !item.isBackorder)
    .reduce((sum, item) => sum + item.quantity, 0);
  return (
    <div className="space-y-4">
      <p className="text-sm text-foreground">
        Required {required} · Allocated {allocated} · Backorder {quote.fulfillment.backorderQuantity} · Shipments{' '}
        {quote.fulfillment.shipmentCount}
      </p>
      <p className="text-xs text-foreground-muted">
        Available stock is on-hand minus reserved. Incoming stock is shown for planning and is not treated as available.
      </p>
      <div className="grid gap-3 md:grid-cols-3">
        {[...byWarehouse.entries()].map(([warehouseId, split]) => {
          const warehouse = catalog?.warehouses.find((item) => item.id === warehouseId);
          return (
            <Card key={warehouseId}>
              <CardDescription>Warehouse</CardDescription>
              <CardTitle className="mt-1 text-base">{warehouse?.name ?? warehouseId.slice(0, 8)}</CardTitle>
              <p className="mt-3 text-2xl font-semibold">{split.quantity}</p>
              <p className="text-xs text-foreground-muted">
                Allocated · available {split.available} (on-hand minus reserved) · incoming {split.incoming}
              </p>
            </Card>
          );
        })}
        <Card>
          <CardDescription>Backorder</CardDescription>
          <CardTitle className="mt-1 text-base">Remaining</CardTitle>
          <p className="mt-3 text-2xl font-semibold">{quote.fulfillment.backorderQuantity}</p>
          <p className="text-xs text-foreground-muted">
            {quote.fulfillment.shipmentCount} shipment{quote.fulfillment.shipmentCount === 1 ? '' : 's'} ·{' '}
            {formatMoney(quote.fulfillment.fulfillmentCost, true)} fulfillment cost
          </p>
        </Card>
      </div>
      {quote.fulfillment.allocations.length === 0 ? (
        <EmptyState title="No fulfillment plan" description="Plan allocation after the quote is approved." />
      ) : null}
    </div>
  );
}

export function CreateQuoteButton({
  catalog,
  token,
  onCreated,
  autoOpen = false,
}: {
  catalog?: DealflowCatalog;
  token?: string;
  onCreated: (quote: QuoteView) => void;
  autoOpen?: boolean;
}) {
  const [open, setOpen] = useState(autoOpen);
  const [customerId, setCustomerId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (autoOpen) {
      setCustomerId(catalog?.customers[0]?.id ?? '');
      setOpen(true);
    }
  }, [autoOpen, catalog?.customers]);

  async function submit() {
    if (!token || !customerId) return;
    setBusy(true);
    setError(undefined);
    try {
      const quote = await createQuote({ customerId }, token);
      setOpen(false);
      onCreated(quote);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to create quote');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        onClick={() => {
          setCustomerId(catalog?.customers[0]?.id ?? '');
          setOpen(true);
        }}
        disabled={!token}
      >
        New quotation
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Create quotation"
        description="Customer and catalog come from the DealFlow360 API."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button loading={busy} onClick={() => void submit()}>
              Create
            </Button>
          </>
        }
      >
        <Select
          label="Customer"
          value={customerId}
          onChange={(event) => setCustomerId(event.target.value)}
          options={(catalog?.customers ?? []).map((customer) => ({
            value: customer.id,
            label: `${customer.name} · ${customer.tier}`,
          }))}
        />
        {error ? <Alert variant="error" className="mt-3">{error}</Alert> : null}
      </Modal>
    </>
  );
}

export function QuoteLink({ quote }: { quote: QuoteView }) {
  return (
    <Link to={`/dealflow/quotes/${quote.id}`} className="font-medium text-foreground hover:underline">
      {quote.number}
    </Link>
  );
}

export function canActOnStep(
  permissions: string[] | undefined,
  roles: string[] | undefined,
  roleKey: ApprovalRoleKey,
): boolean {
  const owned = new Set((permissions ?? []).map((item) => item.toLowerCase()));
  if (owned.has(`dealflow.approvals.${roleKey}`)) return true;
  const roleSet = new Set((roles ?? []).map((item) => item.toLowerCase()));
  if (roleSet.has('admin')) return true;
  return roleKey === 'manager' && roleSet.has('manager');
}

export function OverrideForm({
  quote,
  catalog,
  onSubmit,
  busy,
}: {
  quote: QuoteView;
  catalog?: DealflowCatalog;
  busy: boolean;
  onSubmit: (overrides: Array<{ quoteLineId: string; warehouseId: string; quantity: number }>) => void;
}) {
  const firstWarehouse = catalog?.warehouses[0]?.id ?? '';
  const [lineId, setLineId] = useState(quote.lines[0]?.id ?? '');
  const [warehouseId, setWarehouseId] = useState(firstWarehouse);
  const [quantity, setQuantity] = useState('1');

  return (
    <form
      className="grid gap-3 md:grid-cols-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit([{ quoteLineId: lineId, warehouseId, quantity: Number(quantity) }]);
      }}
    >
      <Select
        label="Line"
        value={lineId}
        onChange={(event) => setLineId(event.target.value)}
        options={quote.lines.map((line) => ({
          value: line.id,
          label: `${line.product?.sku ?? line.productId} × ${line.quantity}`,
        }))}
      />
      <Select
        label="Warehouse"
        value={warehouseId}
        onChange={(event) => setWarehouseId(event.target.value)}
        options={(catalog?.warehouses ?? []).map((item) => ({ value: item.id, label: item.name }))}
      />
      <Input label="Quantity" type="number" min={1} value={quantity} onChange={(event) => setQuantity(event.target.value)} />
      <div className="flex items-end">
        <Button type="submit" variant="outline" loading={busy} disabled={!lineId || !warehouseId}>
          Apply override
        </Button>
      </div>
    </form>
  );
}

export interface RecordMenuItem {
  id: string;
  label: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  disabled?: boolean;
  immediate?: boolean;
  informational?: boolean;
  onConfirm: () => void | Promise<void>;
}

export function editRecordItem(description: string, onConfirm: () => void): RecordMenuItem {
  return {
    id: 'edit',
    label: 'Edit ✏️',
    description,
    immediate: true,
    onConfirm,
  };
}

export function deleteRecordItem(
  description: string,
  onConfirm: () => void | Promise<void>,
  options?: { confirmLabel?: string; unavailable?: string },
): RecordMenuItem {
  if (options?.unavailable) {
    return {
      id: 'delete',
      label: 'Delete 🗑️',
      description: options.unavailable,
      informational: true,
      onConfirm: () => undefined,
    };
  }
  return {
    id: 'delete',
    label: 'Delete 🗑️',
    description,
    confirmLabel: options?.confirmLabel ?? 'Delete permanently',
    destructive: true,
    onConfirm,
  };
}

export function RecordMenu({
  items,
  label = 'Actions',
  buttonLabel,
}: {
  items: RecordMenuItem[];
  label?: string;
  buttonLabel?: string;
}) {
  const visible = items.filter((item) => !item.disabled);
  const [pending, setPending] = useState<RecordMenuItem | null>(null);
  const [busy, setBusy] = useState(false);

  if (!visible.length) return null;

  function openItem(item: RecordMenuItem) {
    if (item.immediate && !item.informational) {
      void item.onConfirm();
      return;
    }
    setPending(item);
  }

  const single = visible.length === 1 && buttonLabel ? visible[0] : null;

  return (
    <div
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      {single ? (
        <Button type="button" size="sm" variant="outline" aria-label={label} onClick={() => openItem(single)}>
          {buttonLabel}
        </Button>
      ) : (
        <Dropdown
          label={label}
          trigger={
            buttonLabel ? (
              <Button type="button" size="sm" variant="outline" aria-label={label}>
                {buttonLabel}
              </Button>
            ) : (
              <Button type="button" size="sm" variant="ghost" aria-label={label} className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">{label}</span>
              </Button>
            )
          }
          items={visible.map((item) => ({
            id: item.id,
            label: item.label,
            destructive: item.destructive,
            onSelect: () => openItem(item),
          }))}
        />
      )}
      <Modal
        open={Boolean(pending)}
        onClose={() => (busy ? undefined : setPending(null))}
        title={pending?.label ?? 'Confirm'}
        description={pending?.description}
        footer={
          <>
            <Button type="button" variant="ghost" disabled={busy} onClick={() => setPending(null)}>
              Back
            </Button>
            {pending?.informational ? null : (
              <Button
                type="button"
                variant={pending?.destructive ? 'danger' : 'primary'}
                loading={busy}
                onClick={() => {
                  if (!pending) return;
                  setBusy(true);
                  void Promise.resolve(pending.onConfirm())
                    .catch(() => undefined)
                    .finally(() => {
                      setBusy(false);
                      setPending(null);
                    });
                }}
              >
                {pending?.confirmLabel ?? pending?.label ?? 'Confirm'}
              </Button>
            )}
          </>
        }
      />
    </div>
  );
}
