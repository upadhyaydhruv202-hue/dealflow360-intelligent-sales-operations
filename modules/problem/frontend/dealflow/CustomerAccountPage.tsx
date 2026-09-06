import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';

import { useAuth } from '@/auth/AuthProvider';
import { getApiErrorMessage } from '@/services/api';
import { Button } from '@/ui';
import { useTheme } from '@/ui/theme/ThemeProvider';

import { listMyQuotes } from './api';
import { formatMoney } from './format';
import type { CustomerQuote } from './types';

export function CustomerAccountPage() {
  const { user, accessToken, logout, pending, ready } = useAuth();
  const { resolvedTheme, toggleTheme } = useTheme();
  const [quotes, setQuotes] = useState<CustomerQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!accessToken) {
      setQuotes([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    listMyQuotes(accessToken)
      .then((items) => {
        if (!cancelled) {
          setQuotes(items);
          setError(undefined);
        }
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(getApiErrorMessage(caught, 'Could not load your quotations.'));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  if (!ready) {
    return <p className="px-6 py-12 text-sm text-foreground-muted">Restoring session…</p>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-surface text-foreground">
      <header className="flex items-center justify-between border-b border-edge px-6 py-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground-muted">DealFlow360</p>
          <h1 className="text-lg font-semibold tracking-tight">Customer account</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleTheme}
            aria-label={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {resolvedTheme === 'dark' ? 'Light' : 'Dark'}
          </Button>
          <Button variant="ghost" size="sm" loading={pending} onClick={() => void logout()}>
            Sign out
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-8 px-6 py-12">
        <div>
          <h2 className="text-display">Quotations for {user.displayName}</h2>
          <p className="mt-3 text-sm leading-6 text-foreground-muted">
            This account is a customer identity. Internal margin, approvals, risk, fulfillment, and audit stay on staff
            APIs — those requests are rejected even if a URL is guessed. Open a quotation through its portal link to send
            a negotiation note, request quantities, or agree to a final quotation.
          </p>
        </div>
        {loading ? <p className="text-sm text-foreground-muted">Loading quotations…</p> : null}
        {error ? (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
        {!loading && !error && quotes.length === 0 ? (
          <p className="text-sm text-foreground-muted">
            No quotations are linked to {user.email} yet. When sales issues a quote to this company, it appears here.
          </p>
        ) : null}
        {!loading && quotes.length > 0 ? (
          <ul className="divide-y divide-edge rounded-lg border border-edge">
            {quotes.map((quote) => (
              <li key={quote.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold">
                    {quote.number} · {quote.customer.name}
                  </p>
                  <p className="text-caption text-foreground-muted">
                    {quote.status.replaceAll('_', ' ')} · {formatMoney(quote.netTotal)} · version {quote.version}
                  </p>
                </div>
                <Link
                  to={`/portal/${encodeURIComponent(quote.portalToken)}`}
                  className="inline-flex h-10 items-center rounded-control border border-edge px-3.5 text-sm font-medium hover:bg-surface-muted"
                >
                  Open portal
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </main>
    </div>
  );
}
