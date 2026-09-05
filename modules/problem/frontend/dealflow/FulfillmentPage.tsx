import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '@/auth/AuthProvider';
import { Breadcrumb, DataTable, ErrorState, LoadingState, PageContainer } from '@/ui';

import { DealflowGate, StatusBadge } from './components';
import { formatMoney } from './format';
import { useQuotes } from './hooks';
import type { QuoteView } from './types';

export function FulfillmentPage() {
  const { accessToken } = useAuth();
  const navigate = useNavigate();
  const quotes = useQuotes(accessToken);
  const rows = useMemo(
    () =>
      (quotes.data ?? []).filter(
        (item) =>
          item.fulfillment.allocations.length > 0 ||
          item.fulfillment.backorderQuantity > 0 ||
          item.status === 'approved' ||
          item.status === 'confirmed' ||
          item.status === 'fulfillment',
      ),
    [quotes.data],
  );

  return (
    <DealflowGate permission="dealflow.quotes.read">
      <PageContainer
        width="wide"
        breadcrumb={<Breadcrumb items={[{ label: 'Dashboard', to: '/dealflow' }, { label: 'Fulfillment' }]} />}
        title="Fulfillment"
        description="Warehouse splits and backorders from the live fulfillment planner."
      >
        {quotes.loading ? <LoadingState label="Loading fulfillment…" /> : null}
        {quotes.error ? <ErrorState message={quotes.error} onRetry={() => void quotes.reload()} /> : null}
        {!quotes.loading && !quotes.error ? (
          <DataTable<QuoteView>
            caption="Fulfillment plans"
            rowId={(row) => row.id}
            rows={rows}
            onRowClick={(row) => navigate(`/dealflow/quotes/${row.id}?tab=fulfillment`)}
            emptyTitle="No fulfillment work"
            emptyDescription="Approve a quote, then accept the suggested warehouse split."
            columns={[
              { id: 'number', header: 'Quote', accessor: (row) => row.number },
              { id: 'customer', header: 'Customer', accessor: (row) => row.customer?.name ?? '—' },
              { id: 'status', header: 'Status', accessor: (row) => <StatusBadge status={row.status} /> },
              {
                id: 'split',
                header: 'Split',
                accessor: (row) =>
                  row.fulfillment.allocations.length
                    ? `${row.fulfillment.allocations.filter((item) => !item.isBackorder).length} warehouse allocation(s)`
                    : 'Not planned',
              },
              { id: 'shipments', header: 'Shipments', accessor: (row) => String(row.fulfillment.shipmentCount) },
              { id: 'backorder', header: 'Backorder', accessor: (row) => String(row.fulfillment.backorderQuantity) },
              { id: 'cost', header: 'Fulfillment cost', accessor: (row) => formatMoney(row.fulfillment.fulfillmentCost, true) },
            ]}
          />
        ) : null}
      </PageContainer>
    </DealflowGate>
  );
}
