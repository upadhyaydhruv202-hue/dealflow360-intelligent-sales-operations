import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { useAuth } from '@/auth/AuthProvider';
import { hasPermission } from '@/lib/rbac';
import { getApiErrorMessage } from '@/services/api';
import { Breadcrumb, Button, ErrorState, Input, LoadingState, PageContainer, useToast } from '@/ui';

import { decideApproval } from './api';
import { ApprovalTimeline, DealflowGate, DecisionBadge, RiskPanel, StatusBadge, canActOnStep } from './components';
import { formatMoney, formatPercent, roleLabel } from './format';
import { useCatalog, useQuote } from './hooks';
import { approvalPriority, approvalSlaLabel } from './intelligence';

export function ApprovalDetailPage() {
  const { quoteId } = useParams<{ quoteId: string }>();
  const { accessToken, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const quoteState = useQuote(quoteId, accessToken);
  const catalog = useCatalog(accessToken);
  const quote = quoteState.data;
  const [reason, setReason] = useState('Approved after risk review');
  const [busy, setBusy] = useState(false);
  const current = quote
    ? [...quote.approvals].filter((item) => item.status === 'pending').sort((left, right) => left.stepOrder - right.stepOrder)[0]
    : undefined;

  async function decide(decision: 'approved' | 'rejected', nextReason = reason) {
    if (!accessToken || !quote || !current) return;
    setBusy(true);
    try {
      const next = await decideApproval(quote.id, current.id, { decision, reason: nextReason }, accessToken);
      quoteState.setQuote(next);
      toast({ title: decision === 'approved' ? 'Approval recorded' : 'Returned to sender', variant: 'success' });
    } catch (caught) {
      toast({ title: getApiErrorMessage(caught, 'Decision failed'), variant: 'error' });
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
              { label: 'Approvals', to: '/dealflow/approvals' },
              { label: quote?.number ?? 'Approval' },
            ]}
          />
        }
        title={quote ? `${quote.number} · ${quote.customer.name}` : 'Approval detail'}
        description="Risk, policy, and the live approval chain for this quotation."
        actions={
          quote ? (
            <Button variant="outline" onClick={() => navigate(`/dealflow/quotes/${quote.id}?tab=approvals`)}>
              Open workspace
            </Button>
          ) : null
        }
      >
        {quoteState.loading ? <LoadingState label="Loading approval…" /> : null}
        {quoteState.error ? <ErrorState message={quoteState.error} onRetry={() => void quoteState.reload()} /> : null}
        {quote ? (
          <div className="space-y-8">
            <section className="grid gap-6 border-y border-edge py-6 md:grid-cols-4">
              <div>
                <p className="text-caption uppercase tracking-[0.12em] text-foreground-muted">Customer</p>
                <p className="mt-2 text-lg font-semibold">{quote.customer.name}</p>
                <p className="text-caption text-foreground-muted capitalize">{quote.customer.tier}</p>
              </div>
              <div>
                <p className="text-caption uppercase tracking-[0.12em] text-foreground-muted">Net total</p>
                <p className="mt-2 text-lg font-semibold">{formatMoney(quote.netTotal, true)}</p>
                <p className="text-caption text-foreground-muted">Blended {formatPercent(quote.blendedDiscountPercent)}</p>
              </div>
              <div>
                <p className="text-caption uppercase tracking-[0.12em] text-foreground-muted">Risk</p>
                <div className="mt-2">
                  <DecisionBadge decision={quote.assessmentDecision} />
                </div>
                <p className="mt-2 text-caption text-foreground-muted">Score {quote.riskScore}</p>
              </div>
              <div>
                <p className="text-caption uppercase tracking-[0.12em] text-foreground-muted">Current step</p>
                <p className="mt-2 text-lg font-semibold">{current ? current.label : 'No pending step'}</p>
                <p className="text-caption text-foreground-muted">
                  {current ? roleLabel(current.roleKey) : approvalSlaLabel(quote)} · {approvalPriority(quote)}
                </p>
              </div>
            </section>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={quote.status} />
              <Link className="text-sm font-medium hover:underline" to={`/dealflow/fulfillment/${quote.id}`}>
                Fulfillment
              </Link>
              <Link className="text-sm font-medium hover:underline" to={`/dealflow/invoices/${quote.id}`}>
                Invoices
              </Link>
              <Link className="text-sm font-medium hover:underline" to={`/dealflow/subscriptions/${quote.id}`}>
                Subscriptions
              </Link>
              {quote.portalToken ? (
                <Link className="text-sm font-medium hover:underline" to={`/portal/${encodeURIComponent(quote.portalToken)}`}>
                  Customer portal
                </Link>
              ) : null}
            </div>
            <RiskPanel quote={quote} policies={catalog.data?.policies ?? []} />
            <ApprovalTimeline approvals={quote.approvals} />
            {current && hasPermission(user, 'dealflow.quotes.approve') ? (
              <div className="max-w-xl space-y-3">
                <Input label="Reason" value={reason} onChange={(event) => setReason(event.target.value)} />
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    loading={busy}
                    disabled={!canActOnStep(user?.permissions, user?.roles, current.roleKey)}
                    onClick={() => {
                      const next = reason.trim() || 'Please revise the requested discount';
                      setReason(next);
                      void decide('rejected', next);
                    }}
                  >
                    Request changes
                  </Button>
                  <Button
                    variant="ghost"
                    loading={busy}
                    disabled={!canActOnStep(user?.permissions, user?.roles, current.roleKey)}
                    onClick={() => void decide('rejected')}
                  >
                    Deny
                  </Button>
                  <Button
                    loading={busy}
                    disabled={!canActOnStep(user?.permissions, user?.roles, current.roleKey)}
                    onClick={() => void decide('approved')}
                  >
                    Approve
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </PageContainer>
    </DealflowGate>
  );
}
