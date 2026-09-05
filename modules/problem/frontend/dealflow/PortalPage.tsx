import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';

import { getApiErrorMessage } from '@/services/api';
import { Alert, Button, EmptyState, ErrorState, Input, LoadingState, useToast } from '@/ui';

import { applyPortalChange, decidePortalQuote, getPortalQuote, portalQuotePdfHref } from './api';
import { formatMoney, formatPercent, isStaleQuoteConflict, statusLabel } from './format';
import { hybridCommercials, portalStatusLabel } from './intelligence';
import type { QuoteView } from './types';

export function CustomerPortalPage() {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();
  const [quote, setQuote] = useState<QuoteView>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [discounts, setDiscounts] = useState<Record<string, string>>({});
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [note, setNote] = useState('');
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

  const negotiable = quote?.status === 'approved' || quote?.status === 'customer_negotiation';
  const commercial = quote ? hybridCommercials(quote) : undefined;
  const decision = quote?.customerDecision ?? 'none';
  const canRespond = negotiable && decision === 'none';

  async function decide(action: 'accepted' | 'declined') {
    if (!token || !quote || inflight.current) return;
    inflight.current = true;
    setBusy(true);
    setError(undefined);
    try {
      const next = await decidePortalQuote(token, {
        expectedVersion: quote.version,
        action,
        comment: note.trim() || undefined,
      });
      setQuote(next);
      toast({ title: action === 'accepted' ? 'Acceptance recorded' : 'Decline recorded', variant: 'success' });
    } catch (caught) {
      const staleConflict = isStaleQuoteConflict(caught);
      const message = staleConflict
        ? 'Quotation updated by another user.'
        : getApiErrorMessage(caught, 'The decision could not be recorded');
      setStale(staleConflict);
      setError(message);
      toast({ title: message, variant: 'error' });
    } finally {
      inflight.current = false;
      setBusy(false);
    }
  }

  async function submit() {
    if (!token || !quote || !negotiable || inflight.current) return;
    inflight.current = true;
    setBusy(true);
    setError(undefined);
    try {
      const next = await applyPortalChange(
        token,
        quote.lines.map((line) => ({
          lineId: line.id,
          quantity: Number(quantities[line.id] ?? line.quantity),
          discountPercent: Number(discounts[line.id] ?? line.discountPercent),
        })),
        quote.version,
      );
      setQuote(next);
      setSubmitted(true);
      toast({ title: 'Negotiation submitted', variant: 'success' });
    } catch (caught) {
      const staleConflict = isStaleQuoteConflict(caught);
      const message = staleConflict
        ? 'Quotation updated by another user.'
        : getApiErrorMessage(caught, 'The quote could not be updated');
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
      <header className="border-b border-edge px-4 py-6 sm:px-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground-muted">Customer portal</p>
        <h1 className="mt-2 text-display">Your quotation</h1>
        <p className="mt-2 max-w-xl text-sm text-foreground-muted">
          A private view of one quotation. Internal tools are not included.
        </p>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-10">
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
            <section className="border-b border-edge pb-8">
              <p className="text-caption text-foreground-muted">{quote.number}</p>
              <h2 className="mt-1 text-title">
                {quote.customer.name} · Status {statusLabel(quote.status)}
              </h2>
              <p className="mt-1 text-sm text-foreground-muted">{portalStatusLabel(quote.status)}</p>
                  <p className="mt-4 text-[34px] font-semibold tracking-tight">{formatMoney(quote.grandTotal ?? quote.netTotal, true)}</p>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <dt className="text-caption text-foreground-muted">List</dt>
                  <dd>{formatMoney(quote.listTotal, true)}</dd>
                </div>
                <div>
                  <dt className="text-caption text-foreground-muted">Discount</dt>
                  <dd>{formatMoney(quote.discountTotal, true)}</dd>
                </div>
                <div>
                  <dt className="text-caption text-foreground-muted">One-time</dt>
                  <dd>{formatMoney(commercial?.oneTimeNet ?? 0, true)}</dd>
                </div>
                <div>
                  <dt className="text-caption text-foreground-muted">Recurring / month</dt>
                  <dd>{formatMoney(commercial?.recurringMonthly ?? 0, true)}</dd>
                </div>
                <div>
                  <dt className="text-caption text-foreground-muted">Tax</dt>
                  <dd>{formatMoney(quote.taxTotal ?? 0, true)}</dd>
                </div>
              </dl>
            </section>
            {quote.status === 'approval_required' ? (
              <Alert variant="warning" title="Awaiting internal approval">
                Your requested change was material. The sales team must approve the quote again before it can proceed.
              </Alert>
            ) : null}
            {submitted && quote.status === 'customer_negotiation' ? (
              <Alert variant="success" title="Change received">
                The quote was updated. If the change stays below the material threshold it does not reopen approval.
              </Alert>
            ) : null}
            <section>
              <h3 className="text-title">Lines</h3>
              <ul className="mt-4 divide-y divide-edge">
                {quote.lines.map((line) => (
                  <li key={line.id} className="py-4">
                    <p className="font-medium">{line.product?.name ?? 'Product'}</p>
                    <p className="text-caption text-foreground-muted">
                      Qty {line.quantity} · {formatMoney(line.listPrice, true)} each ·{' '}
                      {line.product?.billingType === 'recurring' ? 'Recurring' : 'One-time'}
                    </p>
                    {negotiable ? (
                      <div className="mt-3 grid max-w-lg gap-3 sm:grid-cols-2">
                        <Input
                          label="Requested quantity"
                          type="number"
                          min={1}
                          value={quantities[line.id] ?? String(line.quantity)}
                          onChange={(event) => setQuantities((current) => ({ ...current, [line.id]: event.target.value }))}
                        />
                        <Input
                          label="Requested discount %"
                          type="number"
                          min={0}
                          max={100}
                          value={discounts[line.id] ?? String(line.discountPercent)}
                          onChange={(event) => setDiscounts((current) => ({ ...current, [line.id]: event.target.value }))}
                        />
                      </div>
                    ) : (
                      <p className="mt-2 text-sm">Discount {formatPercent(line.discountPercent)}</p>
                    )}
                  </li>
                ))}
              </ul>
              {quote.lines.length === 0 ? <EmptyState title="No lines" /> : null}
            </section>
            {canRespond ? (
              <section className="space-y-3">
                <Input
                  label="Comment for your sales representative"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Optional comment stored with your accept or decline"
                />
                <div className="sticky bottom-0 flex flex-wrap gap-2 border-t border-edge bg-surface/90 py-4 backdrop-blur">
                  <Button loading={busy} onClick={() => void submit()}>
                    Submit counter-offer
                  </Button>
                  <Button variant="outline" disabled={busy} onClick={() => void decide('accepted')}>
                    Accept quotation
                  </Button>
                  <Button variant="ghost" disabled={busy} onClick={() => void decide('declined')}>
                    Decline
                  </Button>
                  {token ? (
                    <a
                      className="inline-flex h-10 items-center rounded-control border border-edge px-3.5 text-sm font-medium hover:bg-surface-muted"
                      href={portalQuotePdfHref(token)}
                    >
                      Download PDF
                    </a>
                  ) : null}
                </div>
                <p className="text-caption text-foreground-muted">
                  Accept and decline are stored on the quotation. A stale version is rejected. Counter-offers still go through
                  the portal API and may reopen approval.
                </p>
              </section>
            ) : null}
            {decision === 'accepted' ? (
              <Alert variant="success" title="You accepted this quotation">
                A representative will confirm it in the staff workspace.
              </Alert>
            ) : null}
            {decision === 'declined' ? (
              <Alert variant="warning" title="You declined this quotation">
                The sales team can still open a revised quotation.
              </Alert>
            ) : null}
            {token && !canRespond ? (
              <a
                className="inline-flex h-10 items-center rounded-control border border-edge px-3.5 text-sm font-medium hover:bg-surface-muted"
                href={portalQuotePdfHref(token)}
              >
                Download PDF
              </a>
            ) : null}
          </div>
        ) : null}
      </main>
    </div>
  );
}
