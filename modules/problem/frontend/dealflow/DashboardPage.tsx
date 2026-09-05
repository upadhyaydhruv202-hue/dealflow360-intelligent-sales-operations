import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '@/auth/AuthProvider';
import { useOptionalFeatures } from '@/features';
import { hasPermission } from '@/lib/rbac';
import {
  ActivityFeed,
  Breadcrumb,
  DashboardLayout,
  ErrorState,
  KpiCard,
  LoadingState,
  PageContainer,
  TableSection,
} from '@/ui';

import { CreateQuoteButton, DecisionBadge, StatusBadge } from './components';
import { DealflowGate } from './components';
import { formatMoney, formatPercent, OPEN_STATUSES, ownerLabel, riskLabel } from './format';
import { useCatalog, useQuotes } from './hooks';

export function DealflowDashboardPage() {
  const { accessToken, user } = useAuth();
  const features = useOptionalFeatures();
  const navigate = useNavigate();
  const quotes = useQuotes(accessToken);
  const catalog = useCatalog(accessToken);
  const rows = quotes.data ?? [];

  const open = rows.filter((item) => OPEN_STATUSES.includes(item.status));
  const pending = rows.filter((item) => item.status === 'approval_required');
  const atRisk = rows.filter(
    (item) => item.assessmentDecision === 'approval_required' || item.assessmentDecision === 'rejected' || item.riskScore >= 70,
  );
  const activeValue = open.reduce((sum, item) => sum + item.netTotal, 0);
  const fulfillmentIssues = rows.filter((item) => (item.fulfillment?.backorderQuantity ?? 0) > 0);
  const billingIssues = rows.filter(
    (item) =>
      (item.status === 'confirmed' || item.status === 'fulfillment' || item.status === 'billing') &&
      (item.billing?.length ?? 0) === 0,
  );
  const recent = [...rows]
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
    .slice(0, 6);

  return (
    <DealflowGate permission="dealflow.quotes.read">
      <PageContainer
        width="wide"
        breadcrumb={<Breadcrumb items={[{ label: 'DealFlow360', to: '/dealflow' }, { label: 'Dashboard' }]} />}
        title="Sales dashboard"
        description={
          features?.isEnabled('odoo')
            ? 'Live command center. Cards open the matching DealFlow360 module. Numbers come from the quote API.'
            : 'Live command center. Cards open the matching DealFlow360 module. Live Odoo is unavailable — confirmations stay local and no remote sale order IDs are created.'
        }
        actions={
          hasPermission(user, 'dealflow.quotes.write') ? (
            <CreateQuoteButton
              catalog={catalog.data}
              token={accessToken}
              onCreated={(quote) => navigate(`/dealflow/quotes/${quote.id}`)}
            />
          ) : null
        }
      >
        {quotes.loading ? <LoadingState label="Loading live sales data…" /> : null}
        {quotes.error ? <ErrorState message={quotes.error} onRetry={() => void quotes.reload()} /> : null}
        {!quotes.loading && !quotes.error ? (
          <DashboardLayout
            kpis={
              <>
                <Link to="/dealflow/quotes?status=open" className="block rounded-xl focus:outline-none focus-visible:ring-2">
                  <KpiCard label="Open quotations" value={String(open.length)} hint="Draft through negotiation" />
                </Link>
                <Link to="/dealflow/approvals" className="block rounded-xl focus:outline-none focus-visible:ring-2">
                  <KpiCard label="Pending approvals" value={String(pending.length)} hint="Waiting on a chain step" />
                </Link>
                <Link to="/dealflow/health" className="block rounded-xl focus:outline-none focus-visible:ring-2">
                  <KpiCard label="At-risk deals" value={String(atRisk.length)} hint="Approval required or high score" />
                </Link>
                <Link to="/dealflow/quotes" className="block rounded-xl focus:outline-none focus-visible:ring-2">
                  <KpiCard label="Active deal value" value={formatMoney(activeValue)} hint="Open quote net total" />
                </Link>
                <Link to="/dealflow/fulfillment" className="block rounded-xl focus:outline-none focus-visible:ring-2">
                  <KpiCard label="Fulfillment issues" value={String(fulfillmentIssues.length)} hint="Backorders present" />
                </Link>
                <Link to="/dealflow/invoices" className="block rounded-xl focus:outline-none focus-visible:ring-2">
                  <KpiCard label="Billing gaps" value={String(billingIssues.length)} hint="Confirmed without schedules" />
                </Link>
              </>
            }
            activity={
              <ActivityFeed
                title="Recent quote activity"
                items={recent.map((item) => ({
                  id: item.id,
                  title: (
                    <Link to={`/dealflow/quotes/${item.id}`} className="hover:underline">
                      {item.number} · {item.customer?.name ?? 'Customer'}
                    </Link>
                  ),
                  description: `${riskLabel(item)} · ${formatPercent(item.blendedDiscountPercent)} blended`,
                  timestamp: new Date(item.updatedAt).toLocaleDateString(),
                  meta: <StatusBadge status={item.status} />,
                }))}
                emptyTitle="No quotations yet"
              />
            }
            table={
              <TableSection title="Attention now" description="Highest-risk open deals from the live quote list.">
                <ul className="divide-y divide-edge">
                  {atRisk.slice(0, 5).map((item) => (
                    <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div>
                        <Link to={`/dealflow/quotes/${item.id}`} className="font-medium hover:underline">
                          {item.number}
                        </Link>
                        <p className="text-xs text-foreground-muted">
                          {item.customer?.name} · {ownerLabel(item.ownerId, user?.id, user?.displayName)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <DecisionBadge decision={item.assessmentDecision} />
                        <span className="text-sm font-medium">{formatMoney(item.netTotal)}</span>
                      </div>
                    </li>
                  ))}
                  {atRisk.length === 0 ? (
                    <li className="py-6 text-sm text-foreground-muted">No at-risk deals in the current book.</li>
                  ) : null}
                </ul>
              </TableSection>
            }
          />
        ) : null}
      </PageContainer>
    </DealflowGate>
  );
}
