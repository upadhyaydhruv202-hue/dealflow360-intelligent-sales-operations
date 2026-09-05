import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

import { useAuth } from '@/auth/AuthProvider';
import { hasPermission } from '@/lib/rbac';
import { getApiErrorMessage } from '@/services/api';
import {
  Alert,
  Breadcrumb,
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  PageContainer,
  Select,
  Tabs,
  useToast,
} from '@/ui';

import {
  addQuoteLine,
  applyRecommendation,
  assessQuote,
  confirmQuote,
  decideApproval,
  generateBilling,
  getRecommendations,
  listQuoteAudit,
  planFulfillment,
  startNegotiation,
  submitQuote,
  updateQuoteLine,
} from './api';
import {
  ApprovalTimeline,
  canActOnStep,
  DealflowGate,
  DecisionBadge,
  FulfillmentBoard,
  NegotiationStory,
  OverrideForm,
  RiskPanel,
  StatusBadge,
} from './components';
import {
  canApplyRecommendation,
  canBill,
  canConfirm,
  canDecide,
  canEditLines,
  canNegotiate,
  canPlan,
  canSubmit,
  formatDate,
  formatMoney,
  formatPercent,
  ownerLabel,
  workspaceToast,
} from './format';
import { useCatalog, useQuote } from './hooks';
import type { AuditEvent, QuoteView, Recommendation } from './types';

export function QuoteWorkspacePage() {
  const { quoteId } = useParams<{ quoteId: string }>();
  const [params, setParams] = useSearchParams();
  const { accessToken, user } = useAuth();
  const { toast } = useToast();
  const tab = params.get('tab') ?? 'lines';
  const quoteState = useQuote(quoteId, accessToken);
  const catalog = useCatalog(accessToken);
  const quote = quoteState.data;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [discount, setDiscount] = useState('16');
  const [reason, setReason] = useState('Approved after risk review');
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const inflight = useRef(false);

  useEffect(() => {
    if (productId || !catalog.data?.products.length) return;
    const hardware = catalog.data.products.find((item) => item.sku === 'HW-CORE-1');
    setProductId(hardware?.id ?? catalog.data.products[0].id);
  }, [catalog.data, productId]);

  useEffect(() => {
    if (!quote || !accessToken) return;
    void getRecommendations(quote.id, accessToken)
      .then(setRecs)
      .catch(() => setRecs([]));
    if (hasPermission(user, 'audit.read')) {
      void listQuoteAudit(quote.id, accessToken)
        .then(setAudit)
        .catch(() => setAudit([]));
    }
  }, [accessToken, quote, user]);

  const visibleRecs = useMemo(
    () => recs.filter((item) => !dismissed.includes(item.relationId)),
    [dismissed, recs],
  );

  function setTab(id: string) {
    setParams(id === 'lines' ? {} : { tab: id });
  }

  async function run(kind: string, action: () => Promise<typeof quote>) {
    if (!accessToken || inflight.current) return;
    inflight.current = true;
    setBusy(true);
    setError(undefined);
    try {
      const next = await action();
      if (next) {
        quoteState.setQuote(next);
        if (kind === 'approve' && next.status === 'approved') {
          setTab('lines');
        } else if (kind === 'submit' || kind === 'reject') {
          setTab('approvals');
        } else if (kind === 'approve') {
          setTab('approvals');
        } else if (kind === 'plan') {
          setTab('fulfillment');
        } else if (kind === 'bill') {
          setTab('billing');
        } else if (kind === 'assess') {
          setTab('risk');
        } else if (kind === 'confirm') {
          setTab('activity');
        }
      }
      toast({ title: workspaceToast(kind), variant: 'success' });
    } catch (caught) {
      const message = getApiErrorMessage(caught, 'The API rejected this action');
      setError(message);
      toast({ title: message, variant: 'error' });
    } finally {
      inflight.current = false;
      setBusy(false);
    }
  }

  return (
    <DealflowGate permission="dealflow.quotes.read">
      <PageContainer
        width="wide"
        breadcrumb={
          <Breadcrumb
            items={[
              { label: 'Quotations', to: '/dealflow/quotes' },
              { label: quote?.number ?? 'Workspace' },
            ]}
          />
        }
        title={quote ? `${quote.number} · ${quote.customer.name}` : 'Quotation workspace'}
        description="What is being sold, what discount was given, why it is risky, and who must approve it."
        actions={quote ? <StatusBadge status={quote.status} /> : null}
      >
        {quoteState.loading ? <LoadingState label="Loading quotation…" /> : null}
        {quoteState.error ? <ErrorState message={quoteState.error} onRetry={() => void quoteState.reload()} /> : null}
        {quote ? (
          <div className="space-y-6">
            {error ? <Alert variant="error">{error}</Alert> : null}
            <section className="grid gap-3 md:grid-cols-4">
              <Card>
                <CardDescription>Customer tier</CardDescription>
                <p className="mt-2 text-lg font-semibold capitalize">{quote.customer.tier}</p>
                <p className="text-xs text-foreground-muted">{quote.customer.email}</p>
              </Card>
              <Card>
                <CardDescription>Net total</CardDescription>
                <p className="mt-2 text-lg font-semibold">{formatMoney(quote.netTotal, true)}</p>
                <p className="text-xs text-foreground-muted">List {formatMoney(quote.listTotal, true)}</p>
              </Card>
              <Card>
                <CardDescription>Blended discount</CardDescription>
                <p className="mt-2 text-lg font-semibold">{formatPercent(quote.blendedDiscountPercent)}</p>
                <p className="text-xs text-foreground-muted">Margin {formatPercent(quote.marginPercent)}</p>
              </Card>
              <Card>
                <CardDescription>Risk</CardDescription>
                <div className="mt-2">
                  <DecisionBadge decision={quote.assessmentDecision} />
                </div>
                <p className="mt-2 text-xs text-foreground-muted">Score {quote.riskScore}</p>
              </Card>
            </section>

            <Card>
              <ol className="grid gap-2 text-sm md:grid-cols-4">
                <li>
                  <p className="text-xs uppercase text-foreground-muted">Sold</p>
                  <p className="font-medium">{quote.lines.map((line) => line.product?.name ?? line.productId).join(', ') || 'No lines yet'}</p>
                </li>
                <li>
                  <p className="text-xs uppercase text-foreground-muted">Discount given</p>
                  <p className="font-medium">{formatPercent(quote.blendedDiscountPercent)} blended</p>
                </li>
                <li>
                  <p className="text-xs uppercase text-foreground-muted">Why it is risky</p>
                  <p className="font-medium">{quote.assessment?.reasons[0] ?? quote.assessmentDecision.replaceAll('_', ' ')}</p>
                </li>
                <li>
                  <p className="text-xs uppercase text-foreground-muted">Who must approve</p>
                  <p className="font-medium">{quote.assessment?.requiredChainName ?? 'None required'}</p>
                </li>
              </ol>
            </Card>

            {busy ? <Alert variant="info">Saving quote… totals and risk refresh from the API.</Alert> : null}
            {quote.odooSaleOrderId ? (
              <Alert variant="info">Odoo sale order {quote.odooSaleOrderId}</Alert>
            ) : ['confirmed', 'fulfillment', 'billing', 'completed'].includes(quote.status) ? (
              <Alert variant="info">Confirmed locally. Live Odoo is unavailable, so no remote sale order ID exists.</Alert>
            ) : null}

            <QuoteActions
              quote={quote}
              user={user}
              busy={busy}
              accessToken={accessToken}
              onSubmit={() => accessToken && void run('submit', () => submitQuote(quote.id, accessToken))}
              onNegotiate={() => accessToken && void run('negotiate', () => startNegotiation(quote.id, accessToken))}
              onConfirm={() => accessToken && void run('confirm', () => confirmQuote(quote.id, accessToken))}
              onBill={() => accessToken && void run('bill', () => generateBilling(quote.id, accessToken))}
              onCopyPortal={() => {
                void navigator.clipboard.writeText(`${window.location.origin}/portal/${quote.portalToken}`);
                toast({ title: 'Portal link copied', variant: 'success' });
              }}
            />

            <NegotiationStory quote={quote} />

            {visibleRecs.length ? (
              <RecommendationList
                items={visibleRecs}
                canAdd={hasPermission(user, 'dealflow.quotes.write') && canApplyRecommendation(quote.status)}
                busy={busy}
                onAdd={(relationId) =>
                  accessToken &&
                  void run('recommend', async () => {
                    const next = await applyRecommendation(quote.id, relationId, accessToken);
                    setDismissed((current) => [...current, relationId]);
                    return next;
                  })
                }
                onDismiss={(relationId) => setDismissed((current) => [...current, relationId])}
              />
            ) : null}

            <Tabs
              value={['lines', 'risk', 'approvals', 'fulfillment', 'billing', 'activity'].includes(tab) ? tab : 'lines'}
              onChange={(id) => setParams(id === 'lines' ? {} : { tab: id })}
              items={[
                {
                  id: 'lines',
                  label: 'Products',
                  content: (
                    <div className="space-y-4">
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-sm">
                          <caption className="sr-only">Quote lines</caption>
                          <thead className="text-xs uppercase text-foreground-muted">
                            <tr>
                              <th className="py-2 pr-3">Product</th>
                              <th className="py-2 pr-3">Qty</th>
                              <th className="py-2 pr-3">Unit</th>
                              <th className="py-2 pr-3">Discount</th>
                              <th className="py-2 pr-3">Limit</th>
                              <th className="py-2">Line net</th>
                            </tr>
                          </thead>
                          <tbody>
                            {quote.lines.map((line) => {
                              const assessed = quote.assessment?.lines.find((item) => item.productId === line.productId);
                              const policy = catalog.data?.policies.find((item) => item.id === assessed?.policyId);
                              return (
                                <tr key={line.id} className="border-t border-edge">
                                  <td className="py-3 pr-3">
                                    <p className="font-medium">{line.product?.name ?? line.productId}</p>
                                    <p className="text-xs text-foreground-muted">{line.product?.sku} · {line.product?.billingType}</p>
                                  </td>
                                  <td className="py-3 pr-3">
                                    {canEditLines(quote.status) && hasPermission(user, 'dealflow.quotes.write') ? (
                                      <DiscountInput
                                        key={`${line.id}-qty-${line.quantity}`}
                                        label={`Quantity for ${line.product?.sku ?? 'line'}`}
                                        value={line.quantity}
                                        min={1}
                                        onCommit={(next) => {
                                          if (next === line.quantity || !accessToken) return;
                                          void run('line', () => updateQuoteLine(quote.id, line.id, { quantity: next }, accessToken));
                                        }}
                                      />
                                    ) : (
                                      line.quantity
                                    )}
                                  </td>
                                  <td className="py-3 pr-3">{formatMoney(line.listPrice, true)}</td>
                                  <td className="py-3 pr-3">
                                    {canEditLines(quote.status) && hasPermission(user, 'dealflow.quotes.write') ? (
                                      <DiscountInput
                                        key={`${line.id}-${line.discountPercent}`}
                                        label={`Discount for ${line.product?.sku ?? 'line'}`}
                                        value={line.discountPercent}
                                        onCommit={(next) => {
                                          if (next === line.discountPercent || !accessToken) return;
                                          void run('line', () => updateQuoteLine(quote.id, line.id, { discountPercent: next }, accessToken));
                                        }}
                                      />
                                    ) : (
                                      formatPercent(line.discountPercent)
                                    )}
                                  </td>
                                  <td className="py-3 pr-3">{policy ? formatPercent(policy.approvalPercent) : '—'}</td>
                                                  <td className="py-3">{assessed ? formatMoney(assessed.netAmount, true) : '—'}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      {quote.lines.length === 0 ? <EmptyState title="No products yet" description="Add a one-time and a recurring product for the golden path." /> : null}
                      {canEditLines(quote.status) && hasPermission(user, 'dealflow.quotes.write') ? (
                        <form
                          className="grid gap-3 md:grid-cols-4"
                          onSubmit={(event) => {
                            event.preventDefault();
                            if (!accessToken) return;
                            void run('line', () =>
                              addQuoteLine(
                                quote.id,
                                { productId, quantity: Number(quantity), discountPercent: Number(discount) },
                                accessToken,
                              ),
                            );
                          }}
                        >
                          <Select
                            label="Product"
                            value={productId}
                            onChange={(event) => setProductId(event.target.value)}
                            options={(catalog.data?.products ?? []).map((item) => ({
                              value: item.id,
                              label: `${item.sku} · ${item.name} (${item.billingType})`,
                            }))}
                          />
                          <Input label="Quantity" type="number" min={1} value={quantity} onChange={(event) => setQuantity(event.target.value)} />
                          <Input label="Discount %" type="number" min={0} max={100} value={discount} onChange={(event) => setDiscount(event.target.value)} />
                          <div className="flex items-end">
                            <Button type="submit" loading={busy}>
                              Add product
                            </Button>
                          </div>
                        </form>
                      ) : null}
                      <dl className="grid gap-3 sm:grid-cols-4">
                        <div>
                          <dt className="text-xs text-foreground-muted">Subtotal</dt>
                          <dd className="font-semibold">{formatMoney(quote.listTotal, true)}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-foreground-muted">Discount</dt>
                          <dd className="font-semibold">{formatMoney(quote.discountTotal, true)}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-foreground-muted">Total</dt>
                          <dd className="font-semibold">{formatMoney(quote.netTotal, true)}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-foreground-muted">Owner</dt>
                          <dd className="font-semibold">{ownerLabel(quote.ownerId, user?.id, user?.displayName)}</dd>
                        </div>
                      </dl>
                    </div>
                  ),
                },
                {
                  id: 'risk',
                  label: 'Discount / Risk',
                  content: (
                    <div className="space-y-4">
                      <RiskPanel quote={quote} policies={catalog.data?.policies ?? []} />
                      {hasPermission(user, 'dealflow.quotes.write') ? (
                        <Button variant="outline" loading={busy} onClick={() => accessToken && void run('assess', () => assessQuote(quote.id, accessToken))}>
                          Refresh assessment
                        </Button>
                      ) : null}
                    </div>
                  ),
                },
                {
                  id: 'approvals',
                  label: 'Approvals',
                  content: (
                    <div className="space-y-4">
                      <ApprovalTimeline approvals={quote.approvals} />
                      {canDecide(quote.status) ? (
                        <Card>
                          <CardTitle>Decision</CardTitle>
                          <CardDescription className="mt-1">
                            Buttons respect RBAC. The API still authorizes the current step.
                          </CardDescription>
                          <Input className="mt-3" label="Reason" value={reason} onChange={(event) => setReason(event.target.value)} />
                          <div className="mt-3 flex flex-wrap gap-2">
                            {quote.approvals
                              .filter((step) => step.status === 'pending')
                              .sort((left, right) => left.stepOrder - right.stepOrder)
                              .slice(0, 1)
                              .map((step) => {
                                const allowed = canActOnStep(user?.permissions, user?.roles, step.roleKey);
                                return (
                                  <div key={step.id} className="flex flex-wrap gap-2">
                                    <Button
                                      disabled={!allowed || !hasPermission(user, 'dealflow.quotes.approve')}
                                      loading={busy}
                                      onClick={() =>
                                        accessToken &&
                                        void run('approve', () => decideApproval(quote.id, step.id, { decision: 'approved', reason }, accessToken))
                                      }
                                    >
                                      Approve {step.label}
                                    </Button>
                                    <Button
                                      variant="danger"
                                      disabled={!allowed || !hasPermission(user, 'dealflow.quotes.approve')}
                                      loading={busy}
                                      onClick={() =>
                                        accessToken &&
                                        void run('reject', () => decideApproval(quote.id, step.id, { decision: 'rejected', reason }, accessToken))
                                      }
                                    >
                                      Return
                                    </Button>
                                    {!allowed ? (
                                      <p className="text-xs text-foreground-muted">This step requires {step.label}.</p>
                                    ) : null}
                                  </div>
                                );
                              })}
                          </div>
                        </Card>
                      ) : null}
                    </div>
                  ),
                },
                {
                  id: 'fulfillment',
                  label: 'Fulfillment',
                  content: (
                    <div className="space-y-4">
                      <FulfillmentBoard quote={quote} catalog={catalog.data} />
                      {canPlan(quote.status) && hasPermission(user, 'dealflow.fulfillment.write') ? (
                        <div className="space-y-3">
                          <Button loading={busy} onClick={() => accessToken && void run('plan', () => planFulfillment(quote.id, accessToken))}>
                            Accept suggested split
                          </Button>
                          <OverrideForm
                            quote={quote}
                            catalog={catalog.data}
                            busy={busy}
                            onSubmit={(overrides) => accessToken && void run('plan', () => planFulfillment(quote.id, accessToken, overrides))}
                          />
                        </div>
                      ) : null}
                    </div>
                  ),
                },
                {
                  id: 'billing',
                  label: 'Billing',
                  content: <BillingPanels quote={quote} />,
                },
                {
                  id: 'activity',
                  label: 'Activity',
                  content: (
                    <ul className="space-y-2 text-sm">
                      {audit.map((item) => (
                        <li key={item.id} className="rounded-lg border border-edge p-3">
                          <p className="font-medium">{item.action}</p>
                          <p className="text-xs text-foreground-muted">{formatDate(item.timestamp)}</p>
                        </li>
                      ))}
                      {audit.length === 0 ? <EmptyState title="No audit events visible" description="Managers and admins can read quote audit history." /> : null}
                    </ul>
                  ),
                },
              ]}
            />

          </div>
        ) : null}
      </PageContainer>
    </DealflowGate>
  );
}

function QuoteActions({
  quote,
  user,
  busy,
  accessToken,
  onSubmit,
  onNegotiate,
  onConfirm,
  onBill,
  onCopyPortal,
}: {
  quote: QuoteView;
  user: ReturnType<typeof useAuth>['user'];
  busy: boolean;
  accessToken?: string;
  onSubmit: () => void;
  onNegotiate: () => void;
  onConfirm: () => void;
  onBill: () => void;
  onCopyPortal: () => void;
}) {
  return (
    <Card>
      <CardTitle>Next action</CardTitle>
      <CardDescription className="mt-1">Each button calls the DealFlow API. Disabled buttons are not available for this status or role.</CardDescription>
      {quote.status === 'approval_required' ? (
        <p className="mt-2 text-sm text-foreground">
          Waiting on{' '}
          {[...quote.approvals]
            .filter((item) => item.status === 'pending')
            .sort((left, right) => left.stepOrder - right.stepOrder)[0]?.label ?? 'the next approver'}
          . Use the Approvals tab or Approval center. Staff cannot approve.
        </p>
      ) : null}
      {canConfirm(quote.status) ? (
        <p className="mt-2 text-xs text-foreground-muted">
          Confirmation is local only. Live Odoo is not configured, so no remote sale order is created.
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {canSubmit(quote.status) && hasPermission(user, 'dealflow.quotes.write') ? (
          <Button loading={busy} disabled={!accessToken} onClick={onSubmit}>
            Submit for approval
          </Button>
        ) : null}
        {canNegotiate(quote.status) && hasPermission(user, 'dealflow.quotes.write') ? (
          <Button variant="outline" loading={busy} disabled={!accessToken} onClick={onNegotiate}>
            Open customer negotiation
          </Button>
        ) : null}
        {canConfirm(quote.status) && hasPermission(user, 'dealflow.quotes.write') ? (
          <Button variant="secondary" loading={busy} disabled={!accessToken} onClick={onConfirm}>
            Confirm quote
          </Button>
        ) : null}
        {canBill(quote.status) && hasPermission(user, 'dealflow.billing.write') ? (
          <Button variant="outline" loading={busy} disabled={!accessToken} onClick={onBill}>
            Generate billing
          </Button>
        ) : null}
        {quote.portalToken ? (
          <Button variant="ghost" onClick={onCopyPortal}>
            Copy customer portal link
          </Button>
        ) : null}
      </div>
    </Card>
  );
}

function RecommendationList({
  items,
  canAdd,
  busy,
  onAdd,
  onDismiss,
}: {
  items: Recommendation[];
  canAdd: boolean;
  busy: boolean;
  onAdd: (relationId: string) => void;
  onDismiss: (relationId: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recommended attach</CardTitle>
        <CardDescription>Backend upsell / cross-sell rules. Add writes a real quote line.</CardDescription>
      </CardHeader>
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.relationId} className="flex flex-col gap-3 rounded-lg border border-edge p-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">
                {item.product.name} · {item.kind.replaceAll('_', '-')}
              </p>
              <p className="text-sm text-foreground-muted">{item.reason}</p>
              <p className="mt-1 text-xs text-foreground-muted">
                Price impact {formatMoney(item.priceImpact, true)} · Margin impact {formatMoney(item.marginImpact, true)}
                {item.promotion ? ` · ${item.promotion}` : ''}
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" loading={busy} disabled={!canAdd} onClick={() => onAdd(item.relationId)}>
                Add
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onDismiss(item.relationId)}>
                Dismiss
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function DiscountInput({
  label,
  value,
  onCommit,
  min = 0,
}: {
  label: string;
  value: number;
  min?: number;
  onCommit: (next: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => {
    setDraft(String(value));
  }, [value]);
  return (
    <Input
      aria-label={label}
      type="number"
      min={min}
      max={min > 0 ? undefined : 100}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        const next = Number(draft);
        if (Number.isNaN(next) || next < min) {
          setDraft(String(value));
          return;
        }
        onCommit(next);
      }}
    />
  );
}

function BillingPanels({ quote }: { quote: QuoteView }) {
  const oneTime = quote.billing.filter((item) => item.billingType === 'one_time');
  const recurring = quote.billing.filter((item) => item.billingType === 'recurring');
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <p className="text-xs text-foreground-muted lg:col-span-2">
        One-time invoices and recurring schedules are separate. The API does not collect or record payments.
      </p>
      <Card>
        <CardTitle>One-time</CardTitle>
        {oneTime.length === 0 ? (
          <EmptyState className="mt-3" title="No one-time invoice" description="Generate billing after approval." />
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {oneTime.map((item) => {
              const line = quote.lines.find((row) => row.id === item.quoteLineId);
              return (
                <li key={item.id} className="flex justify-between gap-3 rounded-lg bg-surface-muted p-3">
                  <span>
                    {line?.product?.name ?? 'Line'} · qty {line?.quantity ?? '—'} · {formatMoney(item.amount, true)}
                  </span>
                  <BadgeLike status={item.status} />
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      <Card>
        <CardTitle>Recurring</CardTitle>
        {recurring.length === 0 ? (
          <EmptyState className="mt-3" title="No subscription schedule" />
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {recurring.map((item) => (
              <li key={item.id} className="rounded-lg bg-surface-muted p-3">
                <div className="flex justify-between gap-3">
                  <span>
                    {(quote.lines.find((row) => row.id === item.quoteLineId)?.product?.name ?? 'Plan')} ·{' '}
                    {formatMoney(item.amount, true)} · {item.frequency ?? 'cycle'}
                  </span>
                  <BadgeLike status={item.status} />
                </div>
                <p className="mt-1 text-xs text-foreground-muted">Next {formatDate(item.nextBillingAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function BadgeLike({ status }: { status: string }) {
  return <span className="text-xs font-semibold uppercase tracking-wide">{status}</span>;
}
