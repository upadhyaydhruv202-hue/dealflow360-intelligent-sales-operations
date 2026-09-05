import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '@/auth/AuthProvider';
import { Breadcrumb, DataTable, ErrorState, LoadingState, PageContainer } from '@/ui';

import { DealflowGate, DecisionBadge, StatusBadge } from './components';
import { formatDate, formatMoney, formatPercent, roleLabel } from './format';
import { useQuotes } from './hooks';
import type { QuoteView } from './types';

export function ApprovalsPage() {
  const { accessToken } = useAuth();
  const navigate = useNavigate();
  const quotes = useQuotes(accessToken);
  const rows = useMemo(
    () => (quotes.data ?? []).filter((item) => item.status === 'approval_required' || item.approvals.some((step) => step.status === 'pending')),
    [quotes.data],
  );

  return (
    <DealflowGate permission="dealflow.quotes.read">
      <PageContainer
        width="wide"
        breadcrumb={<Breadcrumb items={[{ label: 'Dashboard', to: '/dealflow' }, { label: 'Approvals' }]} />}
        title="Approval center"
        description="Quotes waiting on a backend approval chain. Open a row to decide the current step."
      >
        {quotes.loading ? <LoadingState label="Loading approvals…" /> : null}
        {quotes.error ? <ErrorState message={quotes.error} onRetry={() => void quotes.reload()} /> : null}
        {!quotes.loading && !quotes.error ? (
          <DataTable<QuoteView>
            caption="Pending approvals"
            rowId={(row) => row.id}
            rows={rows}
            onRowClick={(row) => navigate(`/dealflow/quotes/${row.id}?tab=approvals`)}
            emptyTitle="No quotes waiting"
            emptyDescription="Submit a discounted quote to create a live approval chain."
            columns={[
              { id: 'number', header: 'Quote', accessor: (row) => row.number },
              { id: 'customer', header: 'Customer', accessor: (row) => row.customer?.name ?? '—' },
              { id: 'risk', header: 'Risk', accessor: (row) => <DecisionBadge decision={row.assessmentDecision} /> },
              { id: 'amount', header: 'Amount', accessor: (row) => formatMoney(row.netTotal) },
              { id: 'blended', header: 'Blended', accessor: (row) => formatPercent(row.blendedDiscountPercent) },
              {
                id: 'stage',
                header: 'Stage',
                accessor: (row) => {
                  const current = [...row.approvals].filter((item) => item.status === 'pending').sort((a, b) => a.stepOrder - b.stepOrder)[0];
                  return current ? `${current.label} · ${roleLabel(current.roleKey)}` : <StatusBadge status={row.status} />;
                },
              },
              { id: 'updated', header: 'Submitted', accessor: (row) => formatDate(row.updatedAt) },
            ]}
          />
        ) : null}
      </PageContainer>
    </DealflowGate>
  );
}
