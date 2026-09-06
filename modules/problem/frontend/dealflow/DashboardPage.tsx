import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '@/auth/AuthProvider';
import { useOptionalFeatures } from '@/features';
import { hasPermission } from '@/lib/rbac';
import {
  ActivityFeed,
  Breadcrumb,
  ChartArea,
  DashboardLayout,
  ErrorState,
  KpiCard,
  LoadingState,
  PageContainer,
  SimpleBarChart,
  TableSection,
} from '@/ui';

import { CreateQuoteButton, DecisionBadge, StatusBadge } from './components';
import { DealflowGate } from './components';
import { formatMoney, formatPercent, OPEN_STATUSES, ownerLabel, riskLabel } from './format';
import { useAnomalies, useCatalog, useQuotes } from './hooks';
import { dashboardAnalytics } from './intelligence';

function greeting(name?: string) {
  const hour = new Date().getHours();
  const hello = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const first = name?.split(' ')[0];
  return first ? `${hello}, ${first}` : hello;
}

export function DealflowDashboardPage() {
  const { accessToken, user } = useAuth();
  const features = useOptionalFeatures();
  const navigate = useNavigate();
  const quotes = useQuotes(accessToken);
  const catalog = useCatalog(accessToken);
  const anomalies = useAnomalies(accessToken);
  const rows = quotes.data ?? [];

  const analytics = dashboardAnalytics(rows);
  const open = rows.filter((item) => OPEN_STATUSES.includes(item.status));
  const pending = analytics.pending;
  const atRisk = rows.filter(
    (item) => item.assessmentDecision === 'approval_required' || item.assessmentDecision === 'rejected' || item.riskScore >= 70,
  );
  const activeValue = analytics.openValue;
  const fulfillmentIssues = rows.filter((item) => (item.fulfillment?.backorderQuantity ?? 0) > 0);
  const billingIssues = rows.filter(
    (item) =>
      (item.status === 'confirmed' || item.status === 'fulfillment' || item.status === 'billing') &&
      (item.billing?.length ?? 0) === 0,
  );
  const alerts = (anomalies.data ?? []).filter((item) => item.status === 'open').slice(0, 4);
  const recent = [...rows]
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
    .slice(0, 6);
  const pipeline = [
    { label: 'Open', value: open.length },
    { label: 'Approvals', value: pending.length },
    { label: 'At risk', value: atRisk.length },
    { label: 'Fulfill', value: fulfillmentIssues.length },
    { label: 'Billing', value: billingIssues.length },
  ];

  return (
    <DealflowGate permission="dealflow.quotes.read">
      <PageContainer
        width="wide"
        breadcrumb={<Breadcrumb items={[{ label: 'DealFlow360', to: '/dealflow' }, { label: 'Dashboard' }]} />}
        eyebrow={greeting(user?.displayName)}
        title="Sales dashboard"
        description={
          features?.isEnabled('odoo')
            ? "Here's what's happening across your workspace. Cards open the matching DealFlow360 module. Numbers come from the quote API."
            : "Here's what's happening across your workspace. Live Odoo is unavailable — confirmations stay local and no remote sale order IDs are created."
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
                <Link to="/dealflow/quotes" className="block rounded-control focus:outline-none focus-visible:ring-2">
                  <KpiCard
                    label="Active deal value"
                    value={formatMoney(activeValue)}
                    hint="Open quote net total"
                    delta={{ label: `${open.length} open`, trend: 'up' }}
                    sparkline={rows.slice(0, 8).map((item) => item.netTotal)}
                  />
                </Link>
                <Link to="/dealflow/quotes?status=open" className="block rounded-control focus:outline-none focus-visible:ring-2">
                  <KpiCard label="Open quotations" value={String(open.length)} hint="Draft through negotiation" />
                </Link>
                <Link to="/dealflow/negotiations" className="block rounded-control focus:outline-none focus-visible:ring-2">
                  <KpiCard
                    label="Under negotiation"
                    value={String(rows.filter((item) => item.status === 'customer_negotiation' || item.status === 'manager_review').length)}
                    hint="Customer and manager review"
                  />
                </Link>
                <Link to="/dealflow/approvals" className="block rounded-control focus:outline-none focus-visible:ring-2">
                  <KpiCard
                    label="Pending approvals"
                    value={String(pending.length)}
                    hint={pending.length ? `${pending.length} waiting` : 'Queue is clear'}
                    delta={{ label: pending.length ? 'Needs review' : 'All clear', trend: pending.length ? 'down' : 'flat' }}
                  />
                </Link>
                <Link to="/dealflow/health" className="block rounded-control focus:outline-none focus-visible:ring-2">
                  <KpiCard label="At-risk deals" value={String(atRisk.length)} hint="Approval required or high score" />
                </Link>
                <Link to="/dealflow/fulfillment" className="block rounded-control focus:outline-none focus-visible:ring-2">
                  <KpiCard label="Fulfillment issues" value={String(fulfillmentIssues.length)} hint="Backorders present" />
                </Link>
                <Link to="/dealflow/invoices" className="block rounded-control focus:outline-none focus-visible:ring-2">
                  <KpiCard label="Billing gaps" value={String(billingIssues.length)} hint="Confirmed without schedules" />
                </Link>
                <Link to="/dealflow/reports" className="block rounded-control focus:outline-none focus-visible:ring-2">
                  <KpiCard
                    label="Conversion"
                    value={formatPercent(analytics.conversion)}
                    hint={`${analytics.won.length} confirmed or later`}
                  />
                </Link>
                <Link to="/dealflow/reports" className="block rounded-control focus:outline-none focus-visible:ring-2">
                  <KpiCard
                    label="Weighted forecast"
                    value={formatMoney(analytics.forecast)}
                    hint="Open value × stage probability"
                    delta={{ label: `${analytics.agingApprovals} aging approvals`, trend: analytics.agingApprovals ? 'down' : 'flat' }}
                  />
                </Link>
              </>
            }
            charts={
              <>
                <ChartArea title="Pipeline mix" description="Live quote counts by operational state.">
                  <SimpleBarChart title="Pipeline mix" data={pipeline} />
                </ChartArea>
                <TableSection title="Contextual alerts" description="Persisted DealFlow anomalies from the PostgreSQL pipeline.">
                  <ul className="divide-y divide-edge">
                    {alerts.map((item) => (
                      <li key={item.id} className="py-3">
                        <Link
                          to={item.quoteId ? `/dealflow/quotes/${item.quoteId}` : '/dealflow/anomalies'}
                          className="font-medium hover:underline"
                        >
                          {item.type.replaceAll('_', ' ')} · {item.severity}
                        </Link>
                        <p className="text-caption text-foreground-muted">{item.description}</p>
                      </li>
                    ))}
                    {alerts.length === 0 ? (
                      <li className="py-6 text-sm text-foreground-muted">No open anomalies on the current book.</li>
                    ) : null}
                  </ul>
                  <Link to="/dealflow/anomalies" className="mt-3 inline-block text-sm font-medium hover:underline">
                    Open anomaly center
                  </Link>
                </TableSection>
                <TableSection title="Action required" description="Highest-risk open deals from the live quote list.">
                  <ul className="divide-y divide-edge">
                    {atRisk.slice(0, 5).map((item) => (
                      <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                        <div>
                          <Link to={`/dealflow/quotes/${item.id}`} className="font-medium hover:underline">
                            {item.number}
                          </Link>
                          <p className="text-caption text-foreground-muted">
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
          />
        ) : null}
      </PageContainer>
    </DealflowGate>
  );
}
