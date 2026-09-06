import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';

import { getApiErrorMessage } from '@/services/api';
import { Alert, Button, EmptyState, ErrorState, Input, LoadingState, useToast } from '@/ui';

import { agreePortalQuote, createPortalNegotiation, decidePortalQuote, getPortalQuote, portalQuotePdfHref } from './api';
import { formatDate, formatMoney, formatPercent, isStaleQuoteConflict } from './format';
import { hybridCommercials, portalStatusLabel } from './intelligence';
import type { NegotiationRequest, QuoteView } from './types';

type LineRequestType = 'question' | 'quantity_change' | 'product_change' | 'removal' | 'pricing' | 'discount' | 'general';

export function CustomerPortalPage() {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();
  const [quote, setQuote] = useState<QuoteView>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [discounts, setDiscounts] = useState<Record<string, string>>({});
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [requestTypes, setRequestTypes] = useState<Record<string, LineRequestType>>({});
  const [openLine, setOpenLine] = useState<string>();
  const [submitted, setSubmitted] = useState(false);
  const [note, setNote] = useState('');
  const [counterPercent, setCounterPercent] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [stale, setStale] = useState(false);
  const inflight = useRef(false);

  async function loadQuote(portalToken: string) {
    const data = await getPortalQuote(portalToken);
    setQuote(data);
    setDiscounts(Object.fromEntries(data.lines.map((line) => [line.id, String(line.discountPercent)])));
    setQuantities(Object.fromEntries(data.lines.map((line) => [line.id, String(line.quantity)])));
    setError(undefined);
    setStale(false);
    return data;
  }

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    void loadQuote(token)
      .catch((caught: unknown) => {
        if (!cancelled) setError(getApiErrorMessage(caught, 'This portal link is not valid'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const negotiable = quote?.status === 'draft' || quote?.status === 'customer_negotiation';
  const commercial = quote?.commercials ?? (quote ? hybridCommercials(quote) : undefined);
  const decision = quote?.customerDecision ?? 'none';
  const latest = quote?.negotiations?.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const pendingRequest =
    latest?.status === 'open' || latest?.status === 'in_review' || latest?.status === 'sent_to_manager';
  const canSubmitRequest = Boolean(negotiable && decision === 'none' && !pendingRequest);
  const canConfirm = Boolean(
    decision === 'none' &&
      !pendingRequest &&
      quote &&
      (quote.status === 'draft' ||
        quote.status === 'customer_negotiation' ||
        quote.status === 'manager_review' ||
        quote.status === 'finalized'),
  );
  const statusText = quote ? portalStatusLabel(quote.status, quote.customerDecision) : '';

  async function submitRequest() {
    if (!token || !quote || !canSubmitRequest || inflight.current) return;
    inflight.current = true;
    setBusy(true);
    setError(undefined);
    try {
      const requestedDiscount = counterPercent
        ? Number(counterPercent)
        : Math.max(...quote.lines.map((line) => Number(discounts[line.id] ?? line.discountPercent)), 0);
      const next = await createPortalNegotiation(token, {
        expectedVersion: quote.version,
        note:
          note.trim() ||
          (counterPercent
            ? `I would like a ${counterPercent}% discount.`
            : 'Customer requested quotation changes.'),
        requestedDiscountPercent: Number.isFinite(requestedDiscount) ? requestedDiscount : null,
        requestedTargetAmount: targetAmount ? Number(targetAmount) : null,
        requestedLines: quote.lines.map((line) => ({
          lineId: line.id,
          quantity: Number(quantities[line.id] ?? line.quantity),
          discountPercent: Number(discounts[line.id] ?? line.discountPercent),
          action: requestTypes[line.id] === 'removal' ? 'remove' : 'update',
          requestType: requestTypes[line.id] ?? (comments[line.id] ? 'general' : 'quantity_change'),
          comment: comments[line.id]?.trim() || undefined,
          originalQuantity: line.quantity,
          originalDiscountPercent: line.discountPercent,
        })),
      });
      setQuote(next);
      setSubmitted(true);
      toast({ title: 'Your request has been submitted to the sales representative.', variant: 'success' });
    } catch (caught) {
      const staleConflict = isStaleQuoteConflict(caught);
      const message = staleConflict
        ? 'Quotation updated by another user.'
        : getApiErrorMessage(caught, 'The request could not be submitted');
      setStale(staleConflict);
      setError(message);
      toast({ title: message, variant: 'error' });
    } finally {
      inflight.current = false;
      setBusy(false);
    }
  }

  async function confirmQuote() {
    if (!token || !quote || !canConfirm || inflight.current) return;
    inflight.current = true;
    setBusy(true);
    setError(undefined);
    try {
      const next = await agreePortalQuote(token, quote.version);
      setQuote(next);
      toast({ title: 'Quotation confirmed', variant: 'success' });
    } catch (caught) {
      const staleConflict = isStaleQuoteConflict(caught);
      const message = staleConflict
        ? 'Quotation updated by another user.'
        : getApiErrorMessage(caught, 'Confirmation could not be recorded');
      setStale(staleConflict);
      setError(message);
      toast({ title: message, variant: 'error' });
    } finally {
      inflight.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface text-foreground">
      <header className="border-b border-edge px-4 py-5 sm:px-10">
        <div className="mx-auto flex max-w-5xl flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground-muted">DealFlow360</p>
            <h1 className="mt-1 text-title">{quote?.number ?? 'Your quotation'}</h1>
          </div>
          {quote ? (
            <p className="text-sm font-medium">
              Status: <span className="text-foreground">{statusText}</span>
            </p>
          ) : null}
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-10">
        {loading ? <LoadingState label="Loading your quote…" /> : null}
        {error && !quote ? <ErrorState title="Unable to open this quote" message={error} /> : null}
        {quote ? (
          <div className="space-y-10">
            {stale ? (
              <Alert variant="warning" title="Quotation updated by another user.">
                Reload the latest quotation before submitting again. Your last change was not saved.
                <div className="mt-3">
                  <Button
                    size="sm"
                    onClick={() => {
                      if (!token) return;
                      void loadQuote(token).catch((caught: unknown) => {
                        setError(getApiErrorMessage(caught, 'The quote could not be reloaded'));
                      });
                    }}
                  >
                    Reload latest
                  </Button>
                </div>
              </Alert>
            ) : error ? (
              <Alert variant="error">{error}</Alert>
            ) : null}

            <section className="grid gap-4 border-b border-edge pb-8 sm:grid-cols-2 lg:grid-cols-4">
              <HeaderFact label="Customer" value={quote.customer.name} />
              <HeaderFact label="Company" value={quote.customer.name} />
              <HeaderFact label="Quotation date" value={formatDate(quote.createdAt)} />
              <HeaderFact label="Revision" value={`v${quote.version}`} />
              <HeaderFact label="Currency" value="USD" />
              <HeaderFact label="List" value={formatMoney(quote.listTotal, true)} />
              <HeaderFact label="Discount" value={formatMoney(quote.discountTotal, true)} />
              <HeaderFact label="Tax" value={formatMoney(quote.taxTotal ?? 0, true)} />
              <HeaderFact label="Estimated total" value={formatMoney(quote.grandTotal ?? quote.netTotal, true)} />
              {quote.loyalty ? (
                <HeaderFact label="Loyalty" value={`${quote.loyalty.tier} · +${quote.loyalty.bonusPercent}%`} />
              ) : null}
            </section>

            {submitted ? (
              <Alert variant="success" title="Your request has been submitted to the sales representative.">
                Status is now Under Negotiation. Quantity changes are on the quotation; requested discounts wait for sales
                review.
              </Alert>
            ) : null}
            {pendingRequest ? (
              <Alert variant="warning" title="Confirmation is unavailable">
                Your request is with the sales team. Confirm after they respond or the manager returns a revision.
              </Alert>
            ) : null}

            <section>
              <h2 className="text-title">Quotation items</h2>
              <ul className="mt-4 divide-y divide-edge">
                {quote.lines.map((line) => (
                  <li key={line.id} className="py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{line.product?.name ?? 'Product'}</p>
                        <p className="text-caption text-foreground-muted">
                          {line.product?.sku} · {line.product?.billingType === 'recurring' ? line.product.billingFrequency ?? 'Recurring' : 'One-time'} ·{' '}
                          {formatMoney(line.listPrice, true)} each
                        </p>
                        {line.product?.description ? (
                          <p className="mt-1 text-sm text-foreground-muted">{line.product.description}</p>
                        ) : null}
                      </div>
                      <p className="text-sm font-medium">
                        {formatMoney(line.listPrice * line.quantity * (1 - line.discountPercent / 100), true)}
                      </p>
                    </div>
                    {canSubmitRequest ? (
                      <div className="mt-3 grid max-w-3xl gap-3 sm:grid-cols-2">
                        <Input
                          label="Quantity"
                          type="number"
                          min={1}
                          value={quantities[line.id] ?? String(line.quantity)}
                          onChange={(event) => setQuantities((current) => ({ ...current, [line.id]: event.target.value }))}
                        />
                        <Input
                          label="Counter discount %"
                          type="number"
                          min={0}
                          max={100}
                          value={discounts[line.id] ?? String(line.discountPercent)}
                          onChange={(event) => setDiscounts((current) => ({ ...current, [line.id]: event.target.value }))}
                        />
                      </div>
                    ) : (
                      <p className="mt-2 text-sm">
                        Qty {line.quantity} · Discount {formatPercent(line.discountPercent)}
                      </p>
                    )}
                    {canSubmitRequest ? (
                      <div className="mt-3">
                        <Button size="sm" variant="ghost" onClick={() => setOpenLine((current) => (current === line.id ? undefined : line.id))}>
                          Comment / Request Change
                        </Button>
                        {openLine === line.id ? (
                          <div className="mt-3 max-w-3xl space-y-3 rounded-lg border border-edge p-3">
                            <label className="block text-sm">
                              <span className="text-caption text-foreground-muted">Request type</span>
                              <select
                                className="mt-1 w-full rounded-control border border-edge bg-surface px-3 py-2 text-sm"
                                value={requestTypes[line.id] ?? 'general'}
                                onChange={(event) =>
                                  setRequestTypes((current) => ({
                                    ...current,
                                    [line.id]: event.target.value as LineRequestType,
                                  }))
                                }
                              >
                                <option value="question">Question</option>
                                <option value="quantity_change">Quantity change</option>
                                <option value="product_change">Product change</option>
                                <option value="removal">Removal request</option>
                                <option value="pricing">Pricing concern</option>
                                <option value="discount">Discount request</option>
                                <option value="general">General negotiation</option>
                              </select>
                            </label>
                            <Input
                              label="Line comment"
                              value={comments[line.id] ?? ''}
                              onChange={(event) => setComments((current) => ({ ...current, [line.id]: event.target.value }))}
                              placeholder="Ask a question or describe the change"
                            />
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
              {quote.lines.length === 0 ? <EmptyState title="No lines" /> : null}
            </section>

            {canSubmitRequest ? (
              <section className="space-y-3 rounded-xl border border-edge p-5">
                <h2 className="text-title">Counter discount proposal</h2>
                <p className="text-sm text-foreground-muted">
                  Requesting a discount does not apply it. The sales representative and manager review the request.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    label="Requested discount %"
                    type="number"
                    min={0}
                    max={100}
                    value={counterPercent}
                    onChange={(event) => setCounterPercent(event.target.value)}
                    placeholder="7"
                  />
                  <Input
                    label="Or target amount"
                    type="number"
                    min={0}
                    value={targetAmount}
                    onChange={(event) => setTargetAmount(event.target.value)}
                  />
                </div>
                <Input
                  label="Negotiation note"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="I would like a 7% discount because we are increasing the quantity to 20 units."
                />
              </section>
            ) : null}

            <section>
              <h2 className="text-title">Negotiation history</h2>
              <NegotiationTimeline items={quote.negotiations ?? []} />
            </section>

            <section className="rounded-xl border border-edge p-5">
              <h2 className="text-title">Summary</h2>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <HeaderFact label="Subtotal" value={formatMoney(quote.listTotal, true)} />
                <HeaderFact label="Discount" value={formatMoney(quote.discountTotal, true)} />
                <HeaderFact label="Tax" value={formatMoney(quote.taxTotal ?? 0, true)} />
                <HeaderFact label="Estimated total" value={formatMoney(quote.grandTotal ?? quote.netTotal, true)} />
                <HeaderFact label="One-time" value={formatMoney(commercial?.oneTimeNet ?? 0, true)} />
                <HeaderFact label="Recurring / month" value={formatMoney(quote.recurringMonthly ?? commercial?.recurringMonthly ?? 0, true)} />
                <HeaderFact
                  label="ARR"
                  value={formatMoney(quote.recurringAnnual ?? (quote.recurringMonthly ?? commercial?.recurringMonthly ?? 0) * 12, true)}
                />
              </dl>
            </section>

            <div className="sticky bottom-0 flex flex-wrap gap-2 border-t border-edge bg-surface/90 py-4 backdrop-blur">
              {canSubmitRequest ? (
                <Button loading={busy} onClick={() => void submitRequest()}>
                  Submit request
                </Button>
              ) : null}
              <Button variant="secondary" loading={busy} disabled={!canConfirm} onClick={() => void confirmQuote()}>
                Confirm quotation
              </Button>
              {decision === 'none' ? (
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => {
                    if (!token || !quote) return;
                    void decidePortalQuote(token, { expectedVersion: quote.version, action: 'declined', comment: note.trim() || undefined })
                      .then((next) => {
                        setQuote(next);
                        toast({ title: 'Quotation declined', variant: 'success' });
                      })
                      .catch((caught: unknown) => {
                        const message = getApiErrorMessage(caught, 'The decision could not be recorded');
                        setError(message);
                        toast({ title: message, variant: 'error' });
                      });
                  }}
                >
                  Decline
                </Button>
              ) : null}
              {token ? (
                <a
                  className="inline-flex h-10 items-center rounded-control border border-edge px-3.5 text-sm font-medium hover:bg-surface-muted"
                  href={portalQuotePdfHref(token)}
                >
                  Download PDF
                </a>
              ) : null}
            </div>
            {decision === 'accepted' ? (
              <Alert variant="success" title="You confirmed this quotation">
                The sales team will complete approval and finance lock. You will receive the final bill after lock.
              </Alert>
            ) : null}
            {decision === 'declined' ? (
              <Alert variant="warning" title="You declined this quotation">
                The sales team can still open a revised quotation.
              </Alert>
            ) : null}
          </div>
        ) : null}
      </main>
    </div>
  );
}

function HeaderFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-caption text-foreground-muted">{label}</dt>
      <dd className="capitalize">{value}</dd>
    </div>
  );
}

function NegotiationTimeline({ items }: { items: NegotiationRequest[] }) {
  if (items.length === 0) {
    return <p className="mt-3 text-sm text-foreground-muted">No negotiation activity yet.</p>;
  }
  return (
    <ol className="mt-4 space-y-4">
      {items.map((item) => (
        <li key={item.id} className="rounded-lg border border-edge px-3 py-3">
          <p className="text-caption text-foreground-muted">
            {(item.actorRole ?? 'customer').replaceAll('_', ' ')} · {item.status.replaceAll('_', ' ')} · {formatDate(item.createdAt)}
          </p>
          <p className="mt-1 text-sm">{item.note}</p>
          {item.requestedDiscountPercent != null ? (
            <p className="text-caption">Requested discount {item.requestedDiscountPercent}%</p>
          ) : null}
          {item.requestedTargetAmount != null ? (
            <p className="text-caption">Target amount {formatMoney(item.requestedTargetAmount, true)}</p>
          ) : null}
          {item.requestedLines.some((line) => line.comment || line.quantity != null) ? (
            <ul className="mt-2 space-y-1 text-caption text-foreground-muted">
              {item.requestedLines.map((line, index) => (
                <li key={`${item.id}-${line.lineId ?? index}`}>
                  {line.requestType ? `${line.requestType.replaceAll('_', ' ')} · ` : ''}
                  {line.originalQuantity != null && line.quantity != null
                    ? `qty ${line.originalQuantity} → ${line.quantity}`
                    : line.quantity != null
                      ? `qty ${line.quantity}`
                      : null}
                  {line.comment ? ` — ${line.comment}` : ''}
                </li>
              ))}
            </ul>
          ) : null}
          {item.responseNote ? (
            <p className="mt-2 text-sm">
              Sales response: {item.responseNote}
              {item.respondedAt ? ` · ${formatDate(item.respondedAt)}` : ''}
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
