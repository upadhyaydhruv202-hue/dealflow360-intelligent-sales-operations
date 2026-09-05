import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';

import { getApiErrorMessage } from '@/services/api';
import { Alert, Button, EmptyState, ErrorState, Input, LoadingState, useToast } from '@/ui';

import { applyPortalChange, getPortalQuote } from './api';
import { formatMoney, formatPercent, statusLabel } from './format';
import {
  hybridCommercials,
  loadPortalIntent,
  portalStatusLabel,
  savePortalIntent,
  type PortalIntent,
} from './intelligence';
import type { QuoteView } from './types';

export function CustomerPortalPage() {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();
  const [quote, setQuote] = useState<QuoteView>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [discounts, setDiscounts] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [intent, setIntent] = useState<PortalIntent | undefined>(() => (token ? loadPortalIntent(token) : undefined));
  const [note, setNote] = useState('');
  const inflight = useRef(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    void getPortalQuote(token)
      .then((data) => {
        if (cancelled) return;
        setQuote(data);
        setDiscounts(Object.fromEntries(data.lines.map((line) => [line.id, String(line.discountPercent)])));
        setError(undefined);
      })
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
  const canRespond = negotiable && !intent;

  async function submit() {
    if (!token || !quote || !negotiable || inflight.current) return;
    inflight.current = true;
    setBusy(true);
    setError(undefined);
    try {
      const next = await applyPortalChange(
        token,
        quote.lines.map((line) => ({ lineId: line.id, discountPercent: Number(discounts[line.id] ?? line.discountPercent) })),
      );
      setQuote(next);
      setSubmitted(true);
      toast({ title: 'Negotiation submitted', variant: 'success' });
    } catch (caught) {
      const message = getApiErrorMessage(caught, 'The quote could not be updated');
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
        {error ? <ErrorState title="Unable to open this quote" message={error} /> : null}
        {quote ? (
          <div className="space-y-10">
            <section className="border-b border-edge pb-8">
              <p className="text-caption text-foreground-muted">{quote.number}</p>
              <h2 className="mt-1 text-title">
                {quote.customer.name} · Status {statusLabel(quote.status)}
              </h2>
              <p className="mt-1 text-sm text-foreground-muted">{portalStatusLabel(quote.status)}</p>
              <p className="mt-4 text-[34px] font-semibold tracking-tight">{formatMoney(quote.netTotal, true)}</p>
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
                      Qty {line.quantity} · {formatMoney(line.listPrice, true)} list ·{' '}
                      {line.product?.billingType === 'recurring' ? 'Recurring' : 'One-time'}
                    </p>
                    {negotiable ? (
                      <div className="mt-3 max-w-xs">
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
                  placeholder="Optional note stored with your response on this device"
                />
                <div className="sticky bottom-0 flex flex-wrap gap-2 border-t border-edge bg-surface/90 py-4 backdrop-blur">
                  <Button loading={busy} onClick={() => void submit()}>
                    Submit counter-offer
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      if (!token) return;
                      savePortalIntent(token, 'accepted');
                      setIntent('accepted');
                      toast({ title: 'Acceptance recorded on this device', variant: 'success' });
                    }}
                  >
                    Accept quotation
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={busy}
                    onClick={() => {
                      if (!token) return;
                      savePortalIntent(token, 'declined');
                      setIntent('declined');
                      toast({ title: 'Decline recorded on this device', variant: 'success' });
                    }}
                  >
                    Decline
                  </Button>
                </div>
                <p className="text-caption text-foreground-muted">
                  Accept and decline are recorded in this browser until staff confirms the quote in DealFlow360. Counter-offers
                  still go through the portal API and may reopen approval.
                </p>
              </section>
            ) : null}
            {intent === 'accepted' ? (
              <Alert variant="success" title="You accepted this quotation">
                {note ? `${note} — ` : ''}A representative will confirm it in the staff workspace. This device no longer
                offers another response.
              </Alert>
            ) : null}
            {intent === 'declined' ? (
              <Alert variant="warning" title="You declined this quotation">
                {note || 'The sales team can still open a revised quotation.'}
              </Alert>
            ) : null}
          </div>
        ) : null}
      </main>
    </div>
  );
}
