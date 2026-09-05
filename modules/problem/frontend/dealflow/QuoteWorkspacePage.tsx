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
  contactVendor,
  decideApproval,
  downloadCustomerQuotePdf,
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
  HealthBadge,
  NegotiationStory,
  OverrideForm,
  RelatedDealLinks,
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
  isStaleQuoteConflict,
  ownerLabel,
  workspaceToast,
} from './format';
import { useCatalog, useDealflowRealtime, useQuote } from './hooks';
import { contextualInsights, hybridCommercials, previewUnitPrice, summarizeDealHealth, warehouseAvailability } from './intelligence';
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
  useDealflowRealtime(accessToken, () => {
    void quoteState.reload();
    void catalog.reload();
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [productId, setProductId] = useState('');
  const [productQuery, setProductQuery] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [discount, setDiscount] = useState('16');
  const [reason, setReason] = useState('Approved after risk review');
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [vendorProductId, setVendorProductId] = useState('');
  const [vendorMessage, setVendorMessage] = useState('');
  const [stale, setStale] = useState(false);
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
    setStale(false);
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
      const message = isStaleQuoteConflict(caught)
        ? 'Quotation updated by another user.'
        : getApiErrorMessage(caught, 'The API rejected this action');
      setStale(isStaleQuoteConflict(caught));
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
        actions={
          quote ? (
            <div className="flex flex-wrap items-center gap-2">
              <HealthBadge health={summarizeDealHealth(quote)} />
              <StatusBadge status={quote.status} />
              {quote.health ? (
                <span className="max-w-xl text-caption text-foreground-muted">{quote.health.explanation}</span>
              ) : null}
            </div>
          ) : null
        }
      >
        {quoteState.loading ? <LoadingState label="Loading quotation…" /> : null}
        {quoteState.error ? <ErrorState message={quoteState.error} onRetry={() => void quoteState.reload()} /> : null}
        {quote ? (
          <div className="space-y-6">
            {error ? <Alert variant="error">{error}</Alert> : null}
            {stale ? (
              <Alert variant="warning" title="Quotation updated by another user.">
                Review the latest version before editing again. Your last change was not saved.
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      setStale(false);
                      setError(undefined);
                      void quoteState.reload();
                    }}
                  >
                    Reload latest
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setStale(false);
                      setError(undefined);
                    }}
                  >
                    Cancel edit
                  </Button>
                </div>
              </Alert>
            ) : null}
            <section className="grid gap-6 border-y border-edge py-6 md:grid-cols-4">
              <div>
                <p className="text-caption uppercase tracking-[0.12em] text-foreground-muted">Customer tier</p>
                <p className="mt-2 text-lg font-semibold capitalize">{quote.customer.tier}</p>
                <p className="text-caption text-foreground-muted">{quote.customer.email}</p>
              </div>
              <div>
                <p className="text-caption uppercase tracking-[0.12em] text-foreground-muted">Net total</p>
                <p className="mt-2 text-lg font-semibold">{formatMoney(quote.netTotal, true)}</p>
                <p className="text-caption text-foreground-muted">
                  List {formatMoney(quote.listTotal, true)} · Tax {formatMoney(quote.taxTotal ?? 0, true)} · Grand{' '}
                  {formatMoney(quote.grandTotal ?? quote.netTotal, true)}
                </p>
              </div>
              <div>
                <p className="text-caption uppercase tracking-[0.12em] text-foreground-muted">Blended discount</p>
                <p className="mt-2 text-lg font-semibold">{formatPercent(quote.blendedDiscountPercent)}</p>
                <p className="text-caption text-foreground-muted">Margin {formatPercent(quote.marginPercent)}</p>
              </div>
              <div>
                <p className="text-caption uppercase tracking-[0.12em] text-foreground-muted">Risk</p>
                <div className="mt-2">
                  <DecisionBadge decision={quote.assessmentDecision} />
                </div>
                <p className="mt-2 text-caption text-foreground-muted">Score {quote.riskScore}</p>
              </div>
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
            {quote.health ? (
              <Alert variant={quote.health.status === 'healthy' ? 'info' : 'warning'} title={`Deal health ${quote.health.score} / 100 · ${quote.health.status.replaceAll('_', ' ')}`}>
                <p>{quote.health.explanation}</p>
                <p className="mt-2 text-caption">{quote.health.recommendedAction}</p>
              </Alert>
            ) : null}
            {quote.odooSaleOrderId || quote.odooIntegration?.saleOrderId ? (
              <Alert variant="info">Odoo sale order {quote.odooSaleOrderId ?? quote.odooIntegration?.saleOrderId}</Alert>
            ) : quote.odooIntegration?.configured === false &&
              ['confirmed', 'fulfillment', 'billing', 'completed'].includes(quote.status) ? (
              <Alert variant="info">Confirmed locally. Odoo is not configured, so no remote sale order was created.</Alert>
            ) : null}

            <RelatedDealLinks quoteId={quote.id} portalToken={quote.portalToken} />

            <QuoteActions
              quote={quote}
              user={user}
              busy={busy}
              accessToken={accessToken}
              onSubmit={() => accessToken && void run('submit', () => submitQuote(quote.id, accessToken))}
              onNegotiate={() => accessToken && void run('negotiate', () => startNegotiation(quote.id, accessToken))}
              onConfirm={() => accessToken && void run('confirm', () => confirmQuote(quote.id, accessToken, quote.version))}
              onBill={() => accessToken && void run('bill', () => generateBilling(quote.id, accessToken, quote.version))}
              onCopyPortal={() => {
                void navigator.clipboard.writeText(`${window.location.origin}/portal/${quote.portalToken}`);
                toast({ title: 'Portal link copied', variant: 'success' });
              }}
              onDownloadPdf={() => {
                if (!accessToken) return;
                void downloadCustomerQuotePdf(quote.id, accessToken).catch((caught: unknown) => {
                  toast({ title: getApiErrorMessage(caught, 'PDF download failed'), variant: 'error' });
                });
              }}
            />

            {quote.assessment?.highValue ? (
              <Alert variant="warning" title="High-value approval required">
                Net {formatMoney(quote.netTotal, true)} meets the configured high-value threshold. The seeded chain
                applies; Admin is not inserted unless a step already requires that role.
              </Alert>
            ) : null}
            {quote.assessment?.mergeRisk ? (
              <Alert variant="warning" title="Approval merge risk">
                {quote.assessment.mergeRiskReasons?.[0] ??
                  'Multiple product lines require review and stay itemized so a merge cannot hide line-level risk.'}
              </Alert>
            ) : null}

            <NegotiationStory quote={quote} />

            {visibleRecs.length ? (
              <RecommendationList
                items={visibleRecs}
                canAdd={hasPermission(user, 'dealflow.quotes.write') && canApplyRecommendation(quote.status)}
                busy={busy}
                onAdd={(relationId) =>
                  accessToken &&
                  void run('recommend', async () => {
                    const next = await applyRecommendation(quote.id, relationId, accessToken, quote.version);
                    setDismissed((current) => [...current, relationId]);
                    return next;
                  })
                }
                onDismiss={(relationId) => setDismissed((current) => [...current, relationId])}
              />
            ) : null}

            <Tabs
              value={['lines', 'insights', 'risk', 'approvals', 'fulfillment', 'billing', 'activity'].includes(tab) ? tab : 'lines'}
              onChange={(id) => setParams(id === 'lines' ? {} : { tab: id })}
              items={[
                {
                  id: 'lines',
                  label: 'Products',
                  content: (
                    <div className="space-y-4">
                      <ul className="space-y-3 lg:hidden">
                        {quote.lines.map((line) => {
                          const assessed = quote.assessment?.lines.find((item) => item.productId === line.productId);
                          const canEdit = canEditLines(quote.status) && hasPermission(user, 'dealflow.quotes.write');
                          return (
                            <li key={`${line.id}-card`} className="rounded-lg border border-edge p-3">
                              <p className="font-medium">{line.product?.name ?? line.productId}</p>
                              <p className="text-xs text-foreground-muted">{line.product?.sku}</p>
                              {canEdit && accessToken ? (
                                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                                  <DiscountInput
                                    key={`${line.id}-m-qty-${line.quantity}`}
                                    label={`Quantity for ${line.product?.sku ?? 'line'}`}
                                    value={line.quantity}
                                    min={1}
                                    onCommit={(next) => {
                                      if (next === line.quantity) return;
                                      void run('line', () =>
                                        updateQuoteLine(quote.id, line.id, { quantity: next, expectedVersion: quote.version }, accessToken),
                                      );
                                    }}
                                  />
                                  <DiscountInput
                                    key={`${line.id}-m-price-${line.listPrice}`}
                                    label={`Unit price for ${line.product?.sku ?? 'line'}`}
                                    value={assessed?.appliedPrice ?? line.listPrice}
                                    min={0}
                                    max={1_000_000}
                                    onCommit={(next) => {
                                      if (next === (assessed?.appliedPrice ?? line.listPrice)) return;
                                      void run('line', () =>
                                        updateQuoteLine(quote.id, line.id, { unitPrice: next, expectedVersion: quote.version }, accessToken),
                                      );
                                    }}
                                  />
                                  <DiscountInput
                                    key={`${line.id}-m-disc-${line.discountPercent}`}
                                    label={`Discount for ${line.product?.sku ?? 'line'}`}
                                    value={line.discountPercent}
                                    onCommit={(next) => {
                                      if (next === line.discountPercent) return;
                                      void run('line', () =>
                                        updateQuoteLine(
                                          quote.id,
                                          line.id,
                                          { discountPercent: next, expectedVersion: quote.version },
                                          accessToken,
                                        ),
                                      );
                                    }}
                                  />
                                </div>
                              ) : (
                                <p className="mt-1 text-sm">
                                  Qty {line.quantity} · {formatMoney(assessed?.appliedPrice ?? line.listPrice, true)} ·{' '}
                                  {formatPercent(line.discountPercent)}
                                </p>
                              )}
                              <p className="mt-1 text-sm">Line {assessed ? formatMoney(assessed.netAmount, true) : '—'}</p>
                              {assessed?.decision && assessed.decision !== 'allowed' ? (
                                <p className="mt-1 text-xs text-warning">{assessed.decision.replaceAll('_', ' ')}</p>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                      <div className="hidden overflow-x-auto lg:block">
                        <table className="min-w-full text-left text-sm">
                          <caption className="sr-only">Quote lines</caption>
                          <thead className="text-xs uppercase text-foreground-muted">
                            <tr>
                              <th className="py-2 pr-3">Product</th>
                              <th className="py-2 pr-3">Qty</th>
                              <th className="py-2 pr-3">Base / applied</th>
                              <th className="py-2 pr-3">Discount</th>
                              <th className="py-2 pr-3">Margin</th>
                              <th className="py-2 pr-3">Warehouses</th>
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
                                    {assessed?.decision && assessed.decision !== 'allowed' ? (
                                      <p className="mt-1 text-xs text-warning">{assessed.decision.replaceAll('_', ' ')}</p>
                                    ) : null}
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
                                          void run('line', () =>
                                            updateQuoteLine(quote.id, line.id, { quantity: next, expectedVersion: quote.version }, accessToken),
                                          );
                                        }}
                                      />
                                    ) : (
                                      line.quantity
                                    )}
                                  </td>
                                  <td className="py-3 pr-3">
                                    {canEditLines(quote.status) && hasPermission(user, 'dealflow.quotes.write') ? (
                                      <DiscountInput
                                        key={`${line.id}-price-${assessed?.appliedPrice ?? line.listPrice}`}
                                        label={`Unit price for ${line.product?.sku ?? 'line'}`}
                                        value={assessed?.appliedPrice ?? line.listPrice}
                                        min={0}
                                        max={1_000_000}
                                        onCommit={(next) => {
                                          if (next === (assessed?.appliedPrice ?? line.listPrice) || !accessToken) return;
                                          void run('line', () =>
                                            updateQuoteLine(
                                              quote.id,
                                              line.id,
                                              { unitPrice: next, expectedVersion: quote.version },
                                              accessToken,
                                            ),
                                          );
                                        }}
                                      />
                                    ) : (
                                      <p>{formatMoney(assessed?.appliedPrice ?? line.listPrice, true)}</p>
                                    )}
                                    <p className="text-xs text-foreground-muted">
                                      List {formatMoney(assessed?.basePrice ?? line.listPrice, true)}
                                      {assessed?.pricingRuleName ? ` · ${assessed.pricingRuleName}` : ''}
                                    </p>
                                  </td>
                                  <td className="py-3 pr-3">
                                    {canEditLines(quote.status) && hasPermission(user, 'dealflow.quotes.write') ? (
                                      <DiscountInput
                                        key={`${line.id}-${line.discountPercent}`}
                                        label={`Discount for ${line.product?.sku ?? 'line'}`}
                                        value={line.discountPercent}
                                        onCommit={(next) => {
                                          if (next === line.discountPercent || !accessToken) return;
                                          void run('line', () =>
                                            updateQuoteLine(
                                              quote.id,
                                              line.id,
                                              { discountPercent: next, expectedVersion: quote.version },
                                              accessToken,
                                            ),
                                          );
                                        }}
                                      />
                                    ) : (
                                      formatPercent(line.discountPercent)
                                    )}
                                    {policy ? (
                                      <p className="text-xs text-foreground-muted">Policy {formatPercent(policy.approvalPercent)}</p>
                                    ) : null}
                                    {assessed?.roleLimitExceeded ? (
                                      <p className="text-xs text-warning">Exceeds your authorized range</p>
                                    ) : null}
                                  </td>
                                  <td className="py-3 pr-3">
                                    {assessed ? formatPercent(assessed.marginPercent) : '—'}
                                  </td>
                                  <td className="py-3 pr-3">
                                    {assessed?.warehouses?.length ? (
                                      <ul className="text-xs text-foreground-muted">
                                        {assessed.warehouses.map((row) => (
                                          <li key={row.warehouseId}>
                                            {row.name}: {row.available}
                                          </li>
                                        ))}
                                        {(assessed.shortfall ?? 0) > 0 ? (
                                          <li className="text-warning">Shortfall {assessed.shortfall}</li>
                                        ) : null}
                                      </ul>
                                    ) : (
                                      '—'
                                    )}
                                  </td>
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
                          className="grid gap-3 md:grid-cols-2 xl:grid-cols-5"
                          onSubmit={(event) => {
                            event.preventDefault();
                            if (!accessToken) return;
                            void run('line', () =>
                              addQuoteLine(
                                quote.id,
                                {
                                  productId,
                                  quantity: Number(quantity),
                                  discountPercent: Number(discount),
                                  expectedVersion: quote.version,
                                },
                                accessToken,
                              ),
                            );
                          }}
                        >
                          <Input
                            label="Product search"
                            value={productQuery}
                            onChange={(event) => setProductQuery(event.target.value)}
                            placeholder="SKU or name"
                          />
                          <Select
                            label="Product"
                            value={productId}
                            onChange={(event) => setProductId(event.target.value)}
                            options={(catalog.data?.products ?? [])
                              .filter((item) =>
                                `${item.sku} ${item.name} ${item.category}`.toLowerCase().includes(productQuery.trim().toLowerCase()),
                              )
                              .map((item) => ({
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
                      {(() => {
                        const product = catalog.data?.products.find((item) => item.id === productId);
                        if (!product) return null;
                        const qty = Number(quantity) || 1;
                        const priced = previewUnitPrice(
                          product,
                          qty,
                          catalog.data?.quantityBreaks,
                          quote.customer.tier,
                        );
                        const houses = warehouseAvailability(catalog.data, product.id);
                        const onHand = houses.reduce((sum, row) => sum + row.available, 0);
                        return (
                          <Card>
                            <CardTitle className="text-base">Selected product</CardTitle>
                            <CardDescription className="mt-1">
                              {product.sku} · {product.name} · {product.billingType.replaceAll('_', '-')}
                            </CardDescription>
                            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                              <div>
                                <dt className="text-xs text-foreground-muted">Base / applicable</dt>
                                <dd className="font-medium">
                                  {formatMoney(product.listPrice, true)} → {formatMoney(priced.unitPrice, true)}
                                </dd>
                                <dd className="text-xs text-foreground-muted">{priced.ruleName}</dd>
                              </div>
                              <div>
                                <dt className="text-xs text-foreground-muted">Whole quantity on hand</dt>
                                <dd className="font-medium">{onHand}</dd>
                              </div>
                              <div className="sm:col-span-2">
                                <dt className="text-xs text-foreground-muted">In which warehouse?</dt>
                                <dd>
                                  {houses.length
                                    ? houses.map((row) => `${row.name}: ${row.available} available / ${row.incoming} incoming`).join(' · ')
                                    : 'No warehouse stock rows'}
                                  {qty > onHand ? ` · shortfall ${qty - onHand}` : ''}
                                </dd>
                              </div>
                            </dl>
                          </Card>
                        );
                      })()}
                      {hasPermission(user, 'dealflow.quotes.write') ? (
                        <form
                          className="grid gap-3 md:grid-cols-2 xl:grid-cols-3"
                          onSubmit={(event) => {
                            event.preventDefault();
                            if (!accessToken || !vendorMessage.trim()) return;
                            void (async () => {
                              if (inflight.current) return;
                              inflight.current = true;
                              setBusy(true);
                              setError(undefined);
                              try {
                                await contactVendor(
                                  quote.id,
                                  { productId: vendorProductId || undefined, message: vendorMessage.trim() },
                                  accessToken,
                                );
                                setVendorMessage('');
                                toast({
                                  title: workspaceToast('vendor'),
                                  description: 'Procurement note recorded. No vendor email was sent.',
                                  variant: 'success',
                                });
                              } catch (caught) {
                                const message = getApiErrorMessage(caught, 'Vendor contact could not be recorded');
                                setError(message);
                                toast({ title: message, variant: 'error' });
                              } finally {
                                inflight.current = false;
                                setBusy(false);
                              }
                            })();
                          }}
                        >
                          <Select
                            label="Contact vendor about"
                            value={vendorProductId}
                            onChange={(event) => setVendorProductId(event.target.value)}
                            options={[
                              { value: '', label: 'Quote / procurement (no SKU)' },
                              ...(catalog.data?.products ?? []).map((item) => ({
                                value: item.id,
                                label: `${item.sku} · ${item.name}`,
                              })),
                            ]}
                          />
                          <Input
                            label="Procurement note"
                            value={vendorMessage}
                            onChange={(event) => setVendorMessage(event.target.value)}
                            placeholder="Availability, lead time, or special pricing"
                          />
                          <div className="flex items-end">
                            <Button type="submit" variant="outline" loading={busy} disabled={!vendorMessage.trim()}>
                              Contact vendor
                            </Button>
                          </div>
                        </form>
                      ) : null}
                      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                        <div>
                          <dt className="text-xs text-foreground-muted">List</dt>
                          <dd className="font-semibold">{formatMoney(quote.listTotal, true)}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-foreground-muted">Discount</dt>
                          <dd className="font-semibold">{formatMoney(quote.discountTotal, true)}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-foreground-muted">One-time</dt>
                          <dd className="font-semibold">{formatMoney(hybridCommercials(quote).oneTimeNet, true)}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-foreground-muted">Recurring / month</dt>
                          <dd className="font-semibold">{formatMoney(hybridCommercials(quote).recurringMonthly, true)}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-foreground-muted">Due today</dt>
                          <dd className="font-semibold">{formatMoney(hybridCommercials(quote).dueToday, true)}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-foreground-muted">Owner</dt>
                          <dd className="font-semibold">{ownerLabel(quote.ownerId, user?.id, user?.displayName)}</dd>
                        </div>
                      </dl>
                      <p className="text-caption text-foreground-muted">
                        Tax is calculated on the server from taxable products and the configured rate. Shipping is not
                        collected on DealFlow quotations.
                      </p>
                    </div>
                  ),
                },
                {
                  id: 'insights',
                  label: 'Assistant',
                  content: (
                    <ul className="divide-y divide-edge">
                      {contextualInsights(quote, catalog.data, visibleRecs).map((item) => (
                        <li key={item.id} className="py-3">
                          <p className="font-medium">{item.title}</p>
                          <p className="mt-1 text-sm text-foreground-muted">{item.detail}</p>
                        </li>
                      ))}
                    </ul>
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
                          <Button
                            loading={busy}
                            onClick={() =>
                              accessToken && void run('plan', () => planFulfillment(quote.id, accessToken, quote.version))
                            }
                          >
                            Accept suggested split
                          </Button>
                          <OverrideForm
                            quote={quote}
                            catalog={catalog.data}
                            busy={busy}
                            onSubmit={(overrides) =>
                              accessToken && void run('plan', () => planFulfillment(quote.id, accessToken, quote.version, overrides))
                            }
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
  onDownloadPdf,
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
  onDownloadPdf: () => void;
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
      {canConfirm(quote.status) && quote.odooIntegration?.configured === false ? (
        <p className="mt-2 text-xs text-foreground-muted">
          Confirmation is local only. Odoo is not configured, so no remote sale order will be created.
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
        {hasPermission(user, 'dealflow.quotes.read') ? (
          <Button variant="ghost" onClick={onDownloadPdf}>
            Download customer PDF
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
  max,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
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
      max={max ?? (min > 0 ? undefined : 100)}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        const next = Number(draft);
        if (Number.isNaN(next) || next < min || (max !== undefined && next > max)) {
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
