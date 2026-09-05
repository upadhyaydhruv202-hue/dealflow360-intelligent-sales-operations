import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '@/auth/AuthProvider';
import { hasPermission } from '@/lib/rbac';
import { getApiErrorMessage } from '@/services/api';
import { Breadcrumb, Button, EmptyState, ErrorState, Input, LoadingState, PageContainer, useToast } from '@/ui';

import { DealflowGate, DecisionBadge, StatusBadge, canActOnStep } from './components';
import { ApprovalTimeline } from './components';
import { decideApproval } from './api';
import { formatMoney, formatPercent, roleLabel } from './format';
import { useQuotes } from './hooks';

export function ApprovalsPage() {
  const { accessToken, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const quotes = useQuotes(accessToken);
  const rows = useMemo(
    () => (quotes.data ?? []).filter((item) => item.status === 'approval_required' || item.approvals.some((step) => step.status === 'pending')),
    [quotes.data],
  );
  const [selectedId, setSelectedId] = useState<string>();
  const [reason, setReason] = useState('Approved after risk review');
  const [busy, setBusy] = useState(false);
  const selected = rows.find((item) => item.id === selectedId) ?? rows[0];
  const current = selected
    ? [...selected.approvals].filter((item) => item.status === 'pending').sort((a, b) => a.stepOrder - b.stepOrder)[0]
    : undefined;

  async function decide(decision: 'approved' | 'rejected') {
    if (!accessToken || !selected || !current) return;
    setBusy(true);
    try {
      await decideApproval(selected.id, current.id, { decision, reason }, accessToken);
      toast({ title: decision === 'approved' ? 'Approval recorded' : 'Returned to sender', variant: 'success' });
      await quotes.reload();
    } catch (caught) {
      toast({ title: getApiErrorMessage(caught, 'Decision failed'), variant: 'error' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <DealflowGate permission="dealflow.quotes.read">
      <PageContainer
        width="full"
        breadcrumb={<Breadcrumb items={[{ label: 'Dashboard', to: '/dealflow' }, { label: 'Approvals' }]} />}
        title="Approval center"
        description="Quotes waiting on a backend approval chain. Select a request, review context, then decide the current step."
      >
        {quotes.loading ? <LoadingState label="Loading approvals…" /> : null}
        {quotes.error ? <ErrorState message={quotes.error} onRetry={() => void quotes.reload()} /> : null}
        {!quotes.loading && !quotes.error && rows.length === 0 ? (
          <EmptyState
            title="No approvals yet"
            description="You're all caught up. Submit a discounted quote to create a live approval chain."
            action={
              <Button variant="outline" onClick={() => navigate('/dealflow/quotes')}>
                Open quotations
              </Button>
            }
          />
        ) : null}
        {!quotes.loading && !quotes.error && selected ? (
          <div className="grid gap-0 lg:grid-cols-[18rem_minmax(0,1fr)_20rem] lg:divide-x lg:divide-edge">
            <aside className="lg:pr-6">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground-muted">
                Approval queue
              </p>
              <ul className="divide-y divide-edge">
                {rows.map((item) => {
                  const active = item.id === selected.id;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        className={`w-full py-3 text-left transition-colors duration-df ${active ? 'text-foreground' : 'text-foreground-muted hover:text-foreground'}`}
                        onClick={() => setSelectedId(item.id)}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-accent' : 'bg-edge'}`} />
                          <span className="text-sm font-medium">{item.number}</span>
                        </div>
                        <p className="mt-1 pl-3.5 text-caption">{item.customer?.name ?? 'Customer'}</p>
                        <p className="pl-3.5 text-sm font-medium text-foreground">{formatMoney(item.netTotal)}</p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </aside>
            <section className="py-6 lg:px-8 lg:py-0">
              <p className="text-caption text-foreground-muted">{selected.number}</p>
              <h2 className="mt-1 text-title">{selected.customer?.name ?? 'Customer'}</h2>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <p className="text-[28px] font-semibold tracking-tight">{formatMoney(selected.netTotal)}</p>
                <StatusBadge status={selected.status} />
                <DecisionBadge decision={selected.assessmentDecision} />
              </div>
              <dl className="mt-8 grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-caption text-foreground-muted">Blended discount</dt>
                  <dd className="text-sm font-medium">{formatPercent(selected.blendedDiscountPercent)}</dd>
                </div>
                <div>
                  <dt className="text-caption text-foreground-muted">Current step</dt>
                  <dd className="text-sm font-medium">
                    {current ? `${current.label} · ${roleLabel(current.roleKey)}` : 'No pending step'}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-caption text-foreground-muted">Why it needs review</dt>
                  <dd className="text-sm font-medium">{selected.assessment?.reasons[0] ?? 'Policy or chain review required.'}</dd>
                </div>
              </dl>
              <div className="mt-8">
                <Button variant="outline" onClick={() => navigate(`/dealflow/quotes/${selected.id}?tab=approvals`)}>
                  Open full workspace
                </Button>
              </div>
            </section>
            <aside className="py-6 lg:pl-6 lg:py-0">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground-muted">Timeline</p>
              <ApprovalTimeline approvals={selected.approvals} />
              {current && hasPermission(user, 'dealflow.quotes.approve') ? (
                <div className="mt-6 space-y-3">
                  <Input label="Reason" value={reason} onChange={(event) => setReason(event.target.value)} />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      loading={busy}
                      disabled={!canActOnStep(user?.permissions, user?.roles, current.roleKey)}
                      onClick={() => void decide('rejected')}
                    >
                      Reject
                    </Button>
                    <Button
                      className="flex-1"
                      loading={busy}
                      disabled={!canActOnStep(user?.permissions, user?.roles, current.roleKey)}
                      onClick={() => void decide('approved')}
                    >
                      Approve
                    </Button>
                  </div>
                </div>
              ) : null}
            </aside>
          </div>
        ) : null}
      </PageContainer>
    </DealflowGate>
  );
}
