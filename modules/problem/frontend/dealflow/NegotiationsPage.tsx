import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '@/auth/AuthProvider';
import { hasPermission } from '@/lib/rbac';
import { getApiErrorMessage } from '@/services/api';
import { Breadcrumb, DataTable, ErrorState, LoadingState, PageContainer, useToast } from '@/ui';

import { voidQuote } from './api';
import { DealflowGate, RecordMenu, StatusBadge } from './components';
import { canVoidQuote, formatDate, formatMoney, formatPercent } from './format';
import { useQuotes } from './hooks';
import type { QuoteView } from './types';

export function NegotiationsPage() {
  const { accessToken, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const quotes = useQuotes(accessToken);
  const rows = useMemo(() => {
    return (quotes.data ?? []).filter(
      (quote) =>
        quote.status === 'customer_negotiation' ||
        quote.status === 'manager_review' ||
        (quote.negotiations?.some((item) => item.status === 'open' || item.status === 'in_review') ?? false),
    );
  }, [quotes.data]);

  return (
    <DealflowGate permission="dealflow.quotes.read">
      <PageContainer
        width="wide"
        breadcrumb={<Breadcrumb items={[{ label: 'Dashboard', to: '/dealflow' }, { label: 'Customer negotiations' }]} />}
        title="Customer negotiations"
        description="Open customer requests from PostgreSQL. Respond, modify the quotation, send an update, or escalate to a manager."
      >
        {quotes.loading ? <LoadingState label="Loading negotiations…" /> : null}
        {quotes.error ? <ErrorState message={quotes.error} onRetry={() => void quotes.reload()} /> : null}
        {!quotes.loading && !quotes.error ? (
          <DataTable<QuoteView>
            caption="Customer negotiations"
            rowId={(row) => row.id}
            rows={rows}
            onRowClick={(row) => navigate(`/dealflow/quotes/${row.id}`)}
            emptyTitle="No open customer negotiations"
            emptyDescription="Portal submit requests appear here."
            columns={[
              { id: 'number', header: 'Quote', accessor: (row) => row.number, sortable: true },
              { id: 'customer', header: 'Customer', accessor: (row) => row.customer?.name ?? '—' },
              { id: 'net', header: 'Current total', accessor: (row) => formatMoney(row.netTotal, true) },
              {
                id: 'requested',
                header: 'Requested discount',
                accessor: (row) => {
                  const latest = row.negotiations?.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
                  return latest?.requestedDiscountPercent != null ? formatPercent(latest.requestedDiscountPercent) : '—';
                },
              },
              { id: 'current', header: 'Current discount', accessor: (row) => formatPercent(row.blendedDiscountPercent) },
              { id: 'tier', header: 'Customer tier', accessor: (row) => row.loyalty?.tier ?? row.customer?.tier ?? '—' },
              {
                id: 'neg',
                header: 'Negotiation',
                accessor: (row) => {
                  const latest = row.negotiations?.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
                  return (latest?.status ?? row.status).replaceAll('_', ' ');
                },
              },
              {
                id: 'note',
                header: 'Last request',
                accessor: (row) => {
                  const latest = row.negotiations?.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
                  return latest?.note ?? '—';
                },
              },
              { id: 'updated', header: 'Updated', accessor: (row) => formatDate(row.updatedAt) },
              { id: 'status', header: 'Quote status', accessor: (row) => <StatusBadge status={row.status} /> },
              {
                id: 'actions',
                header: '',
                accessor: (row) =>
                  canVoidQuote(row.status) && hasPermission(user, 'dealflow.quotes.write') ? (
                    <RecordMenu
                      items={[
                        {
                          id: 'void',
                          label: 'Void',
                          description: `Void ${row.number}. Historical commercial records stay intact; the quote becomes rejected.`,
                          confirmLabel: 'Void quotation',
                          destructive: true,
                          onConfirm: async () => {
                            if (!accessToken) return;
                            try {
                              await voidQuote(row.id, accessToken, row.version);
                              toast({ title: 'Quotation voided', variant: 'success' });
                              await quotes.reload();
                            } catch (caught) {
                              toast({ title: getApiErrorMessage(caught, 'Quotation could not be voided'), variant: 'error' });
                            }
                          },
                        },
                      ]}
                    />
                  ) : null,
              },
            ]}
          />
        ) : null}
      </PageContainer>
    </DealflowGate>
  );
}
