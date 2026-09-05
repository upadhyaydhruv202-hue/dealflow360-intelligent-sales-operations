import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';

import { getApiErrorMessage } from '@/services/api';
import { Alert, Button, Card, CardDescription, CardTitle, EmptyState, ErrorState, Input, LoadingState, useToast } from '@/ui';

import { applyPortalChange, getPortalQuote } from './api';
import { formatMoney, formatPercent, statusLabel } from './format';
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
      <header className="border-b border-edge bg-surface-elevated px-4 py-4 sm:px-8">
        <p className="text-xs uppercase tracking-[0.2em] text-foreground-muted">Customer portal</p>
        <h1 className="mt-1 text-xl font-semibold">Your quotation</h1>
        <p className="mt-1 text-sm text-foreground-muted">A private view of one quotation. Internal tools are not included.</p>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-8">
        {loading ? <LoadingState label="Loading your quote…" /> : null}
        {error ? <ErrorState title="Unable to open this quote" message={error} /> : null}
        {quote ? (
          <div className="space-y-6">
            <Card>
              <CardTitle>{quote.number}</CardTitle>
              <CardDescription className="mt-1">
                {quote.customer.name} · Status {statusLabel(quote.status)}
              </CardDescription>
              <p className="mt-4 text-3xl font-semibold">{formatMoney(quote.netTotal, true)}</p>
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-xs text-foreground-muted">List</dt>
                  <dd>{formatMoney(quote.listTotal, true)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-foreground-muted">Discount</dt>
                  <dd>{formatMoney(quote.discountTotal, true)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-foreground-muted">Blended</dt>
                  <dd>{formatPercent(quote.blendedDiscountPercent)}</dd>
                </div>
              </dl>
            </Card>
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
            <Card>
              <CardTitle>Lines</CardTitle>
              <ul className="mt-4 space-y-4">
                {quote.lines.map((line) => (
                  <li key={line.id} className="rounded-lg border border-edge p-3">
                    <p className="font-medium">{line.product?.name ?? 'Product'}</p>
                    <p className="text-xs text-foreground-muted">
                      Qty {line.quantity} · {formatMoney(line.listPrice, true)} list
                    </p>
                    <Input
                      className="mt-3"
                      label="Requested discount %"
                      type="number"
                      min={0}
                      max={100}
                      disabled={!negotiable}
                      value={discounts[line.id] ?? String(line.discountPercent)}
                      onChange={(event) => setDiscounts((current) => ({ ...current, [line.id]: event.target.value }))}
                    />
                  </li>
                ))}
              </ul>
              {quote.lines.length === 0 ? <EmptyState title="No lines on this quote" /> : null}
              <div className="mt-4">
                <Button loading={busy} disabled={!negotiable} onClick={() => void submit()}>
                  Submit requested changes
                </Button>
                {!negotiable ? (
                  <p className="mt-2 text-xs text-foreground-muted">This quotation is not open for changes right now.</p>
                ) : null}
              </div>
            </Card>
            <p className="text-xs text-foreground-muted">
              This link is unique to your quotation. Internal approvals, warehouse stock, and audit history are not shown here.
            </p>
          </div>
        ) : null}
      </main>
    </div>
  );
}
