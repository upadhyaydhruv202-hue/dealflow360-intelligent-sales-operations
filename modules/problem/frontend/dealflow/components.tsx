import { Link, Navigate } from 'react-router-dom';
import { useState } from 'react';

import { useAuth } from '@/auth/AuthProvider';
import { SessionGate } from '@/auth/SessionGate';
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
  Modal,
  Select,
} from '@/ui';

import { createQuote } from './api';
import {
  approvalTone,
  availableUnits,
  decisionTone,
  formatDate,
  formatMoney,
  formatPercent,
  riskLabel,
  roleLabel,
  statusLabel,
  statusTone,
} from './format';
import type {
  ApprovalRoleKey,
  DealflowCatalog,
  DiscountPolicy,
  LineAssessment,
  QuoteApproval,
  QuoteView,
} from './types';

export function DealflowGate({
  permission,
  children,
}: {
  permission: string;
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  return (
    <SessionGate title="Sign in to DealFlow360" hint="Use a seeded staff, manager, or admin account.">
      {hasPermission(user, permission) ? children : <Navigate to="/account" replace />}
    </SessionGate>
  );
}

export function StatusBadge({ status }: { status: QuoteView['status'] }) {
  return <Badge tone={statusTone(status)}>{statusLabel(status)}</Badge>;
}

export function DecisionBadge({ decision }: { decision: QuoteView['assessmentDecision'] }) {
  return <Badge tone={decisionTone(decision)}>{decision.replaceAll('_', ' ')}</Badge>;
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
        {assessment?.reasons[0] ? (
          <p>
            <span className="font-semibold">Why: </span>
            {assessment.reasons[0]}
          </p>
        ) : null}
      </div>
      <div className="space-y-3">
        {(risky.length ? risky : lines).map((line) => {
          const policy = policyForLine(policies, line);
          const allowed = policy?.approvalPercent;
          const delta = allowed == null ? null : line.discountPercent - allowed;
          const productName = quote.lines.find((item) => item.productId === line.productId)?.product?.name ?? line.sku;
          return (
            <div key={`${line.productId}-${line.sku}`} className="rounded-lg bg-surface-muted p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{productName}</p>
                  <p className="mt-1 text-xs text-foreground-muted">{line.sku} · {line.policyName}</p>
                </div>
                <Badge tone={decisionTone(line.decision)}>{line.decision.replaceAll('_', ' ')}</Badge>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
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
              </dl>
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
  const pending = quote.approvals.some((item) => item.status === 'pending');
  const steps = [
    { id: 'approved', label: 'Approved', active: quote.status === 'approved' || material || invalidated },
    { id: 'negotiate', label: 'Customer negotiation', active: quote.status === 'customer_negotiation' || material },
    { id: 'material', label: 'Material change', active: material },
    { id: 'reapprove', label: 'Re-approval required', active: quote.status === 'approval_required' && (material || invalidated) },
    { id: 'chain', label: 'Approval chain', active: pending || (quote.status === 'approved' && invalidated) },
    { id: 'again', label: 'Approved again', active: quote.status === 'approved' && invalidated },
  ];
  return (
    <Card>
      <CardTitle className="mb-3">Negotiation path</CardTitle>
      <ol className="grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
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
  const byWarehouse = new Map<string, { quantity: number; available: number }>();
  for (const allocation of quote.fulfillment.allocations.filter((item) => !item.isBackorder)) {
    const line = quote.lines.find((item) => item.id === allocation.quoteLineId);
    const available = line ? availableUnits(catalog?.stock, allocation.warehouseId, line.productId) : 0;
    const current = byWarehouse.get(allocation.warehouseId) ?? { quantity: 0, available };
    current.quantity += allocation.quantity;
    current.available = Math.min(current.available || available, available);
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
      <p className="text-xs text-foreground-muted">Available stock is on-hand minus reserved from the catalog API.</p>
      <div className="grid gap-3 md:grid-cols-3">
        {[...byWarehouse.entries()].map(([warehouseId, split]) => {
          const warehouse = catalog?.warehouses.find((item) => item.id === warehouseId);
          return (
            <Card key={warehouseId}>
              <CardDescription>Warehouse</CardDescription>
              <CardTitle className="mt-1 text-base">{warehouse?.name ?? warehouseId.slice(0, 8)}</CardTitle>
              <p className="mt-3 text-2xl font-semibold">{split.quantity}</p>
              <p className="text-xs text-foreground-muted">
                Allocated · available {split.available} (on-hand minus reserved)
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
}: {
  catalog?: DealflowCatalog;
  token?: string;
  onCreated: (quote: QuoteView) => void;
}) {
  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

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
