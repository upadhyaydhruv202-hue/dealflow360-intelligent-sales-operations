import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { useAuth } from '@/auth/AuthProvider';
import { hasPermission } from '@/lib/rbac';
import { getApiErrorMessage } from '@/services/api';
import { Breadcrumb, Button, ErrorState, LoadingState, PageContainer, useToast } from '@/ui';

import { completeQuote, confirmQuote, planFulfillment } from './api';
import { DealflowGate, FulfillmentBoard, OverrideForm, StatusBadge } from './components';
import { canConfirm, canPlan, formatMoney } from './format';
import { useCatalog, useQuote } from './hooks';

export function FulfillmentDetailPage() {
  const { quoteId } = useParams<{ quoteId: string }>();
  const { accessToken, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const quoteState = useQuote(quoteId, accessToken);
  const catalog = useCatalog(accessToken);
  const quote = quoteState.data;
  const [busy, setBusy] = useState(false);
  const canComplete =
    quote &&
    (quote.status === 'confirmed' || quote.status === 'fulfillment' || quote.status === 'billing') &&
    hasPermission(user, 'dealflow.quotes.write');

  async function run(action: () => Promise<typeof quote>) {
    if (!accessToken) return;
    setBusy(true);
    try {
      const next = await action();
      if (next) quoteState.setQuote(next);
      toast({ title: 'Fulfillment updated', variant: 'success' });
    } catch (caught) {
      toast({ title: getApiErrorMessage(caught, 'Fulfillment update failed'), variant: 'error' });
    } finally {
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
              { label: 'Dashboard', to: '/dealflow' },
              { label: 'Fulfillment', to: '/dealflow/fulfillment' },
              { label: quote?.number ?? 'Plan' },
            ]}
          />
        }
        title={quote ? `${quote.number} · ${quote.customer.name}` : 'Fulfillment detail'}
        description="Warehouse split, available stock, incoming visibility, and backorders from the live planner."
        actions={
          quote ? (
            <Button variant="outline" onClick={() => navigate(`/dealflow/quotes/${quote.id}?tab=fulfillment`)}>
              Open workspace
            </Button>
          ) : null
        }
      >
        {quoteState.loading ? <LoadingState label="Loading fulfillment…" /> : null}
        {quoteState.error ? <ErrorState message={quoteState.error} onRetry={() => void quoteState.reload()} /> : null}
        {quote ? (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge status={quote.status} />
              <p className="text-sm text-foreground-muted">
                Net {formatMoney(quote.netTotal, true)} · Backorder {quote.fulfillment.backorderQuantity}
              </p>
              <Link className="text-sm font-medium hover:underline" to={`/dealflow/approvals/${quote.id}`}>
                Approvals
              </Link>
              <Link className="text-sm font-medium hover:underline" to={`/dealflow/invoices/${quote.id}`}>
                Invoices
              </Link>
            </div>
            <FulfillmentBoard quote={quote} catalog={catalog.data} />
            {canPlan(quote.status) && hasPermission(user, 'dealflow.fulfillment.write') ? (
              <div className="space-y-3">
                <Button
                  loading={busy}
                  onClick={() => accessToken && void run(() => planFulfillment(quote.id, accessToken, quote.version))}
                >
                  Accept suggested split
                </Button>
                <OverrideForm
                  quote={quote}
                  catalog={catalog.data}
                  busy={busy}
                  onSubmit={(overrides) =>
                    accessToken && void run(() => planFulfillment(quote.id, accessToken, quote.version, overrides))
                  }
                />
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {canConfirm(quote.status) && hasPermission(user, 'dealflow.quotes.write') ? (
                <Button
                  variant="secondary"
                  loading={busy}
                  onClick={() => accessToken && void run(() => confirmQuote(quote.id, accessToken, quote.version))}
                >
                  Confirm quote
                </Button>
              ) : null}
              {canComplete ? (
                <Button
                  loading={busy}
                  onClick={() => accessToken && void run(() => completeQuote(quote.id, accessToken, quote.version))}
                >
                  Complete deal
                </Button>
              ) : null}
            </div>
            <p className="text-caption text-foreground-muted">
              Completing a confirmed deal walks fulfillment → billing → completed on the server. There is no separate
              shipment carrier integration.
            </p>
          </div>
        ) : null}
      </PageContainer>
    </DealflowGate>
  );
}
