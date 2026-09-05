import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { useAuth } from '@/auth/AuthProvider';
import { hasPermission } from '@/lib/rbac';
import { Breadcrumb, DataTable, ErrorState, LoadingState, PageContainer, Pagination, Search } from '@/ui';

import { CreateQuoteButton, DealflowGate, DecisionBadge, StatusBadge, StatusCards } from './components';
import { formatDate, formatMoney, formatPercent, OPEN_STATUSES, ownerLabel } from './format';
import { useCatalog, useQuotes } from './hooks';
import type { QuoteStatus, QuoteView } from './types';

const PAGE_SIZE = 8;

const FILTERS: Array<{ value: 'all' | 'open' | QuoteStatus; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'draft', label: 'Draft' },
  { value: 'approval_required', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'customer_negotiation', label: 'Negotiation' },
  { value: 'rejected', label: 'Rejected' },
];

export function QuotesListPage() {
  const { accessToken, user } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const quotes = useQuotes(accessToken);
  const catalog = useCatalog(accessToken);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const statusFilter = (params.get('status') ?? 'all') as 'all' | 'open' | QuoteStatus;

  const filtered = useMemo(() => {
    const rows = quotes.data ?? [];
    return rows.filter((row) => {
      if (statusFilter === 'open' && !OPEN_STATUSES.includes(row.status)) return false;
      if (statusFilter !== 'all' && statusFilter !== 'open' && row.status !== statusFilter) return false;
      const haystack = `${row.number} ${row.customer?.name ?? ''} ${row.status}`.toLowerCase();
      return haystack.includes(query.trim().toLowerCase());
    });
  }, [query, quotes.data, statusFilter]);

  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const allRows = quotes.data ?? [];
  const statusCards: Array<{ id: QuoteStatus; label: string; filter: QuoteStatus }> = [
    { id: 'draft', label: 'Draft', filter: 'draft' },
    { id: 'approval_required', label: 'Pending approval', filter: 'approval_required' },
    { id: 'approved', label: 'Approved', filter: 'approved' },
    { id: 'customer_negotiation', label: 'Negotiation', filter: 'customer_negotiation' },
    { id: 'rejected', label: 'Declined', filter: 'rejected' },
  ];

  return (
    <DealflowGate permission="dealflow.quotes.read">
      <PageContainer
        width="wide"
        breadcrumb={<Breadcrumb items={[{ label: 'Dashboard', to: '/dealflow' }, { label: 'Quotations' }]} />}
        title="Quotations"
        description="Search and open a live quote workspace. Totals and risk come from the backend assessment."
        actions={
          hasPermission(user, 'dealflow.quotes.write') ? (
            <CreateQuoteButton
              catalog={catalog.data}
              token={accessToken}
              autoOpen={params.get('new') === '1'}
              onCreated={(quote) => navigate(`/dealflow/quotes/${quote.id}`)}
            />
          ) : null
        }
      >
        <StatusCards
          items={statusCards.map((card) => ({
            id: card.id,
            label: card.label,
            value: allRows.filter((row) => row.status === card.filter).length,
            active: statusFilter === card.filter,
            onClick: () => {
              setPage(1);
              setParams({ status: card.filter });
            },
          }))}
        />
        <div className="mb-5 flex flex-col gap-4">
          <Search value={query} onChange={setQuery} placeholder="Search number or customer" aria-label="Search quotations" />
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Quote status">
            {FILTERS.map((filter) => {
              const active = statusFilter === filter.value;
              return (
                <button
                  key={filter.value}
                  type="button"
                  className={`rounded-full border px-3 py-1.5 text-caption transition-colors duration-df ${
                    active
                      ? 'border-foreground bg-foreground text-foreground-inverted'
                      : 'border-edge text-foreground-muted hover:border-foreground/30 hover:text-foreground'
                  }`}
                  onClick={() => {
                    setPage(1);
                    setParams(filter.value === 'all' ? {} : { status: filter.value });
                  }}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>
        </div>
        {quotes.loading ? <LoadingState label="Loading quotations…" /> : null}
        {quotes.error ? <ErrorState message={quotes.error} onRetry={() => void quotes.reload()} /> : null}
        {!quotes.loading && !quotes.error ? (
          <>
            <DataTable<QuoteView>
              caption="DealFlow360 quotations"
              rowId={(row) => row.id}
              rows={pageRows}
              onRowClick={(row) => navigate(`/dealflow/quotes/${row.id}`)}
              emptyTitle="No quotations match"
              emptyDescription="Create a quote or clear filters. Seeded demo quote DF-00001 appears after login."
              columns={[
                { id: 'number', header: 'Quote', accessor: (row) => row.number, sortable: true },
                { id: 'customer', header: 'Customer', accessor: (row) => row.customer?.name ?? '—' },
                { id: 'amount', header: 'Amount', accessor: (row) => formatMoney(row.netTotal), sortable: true },
                { id: 'status', header: 'Status', accessor: (row) => <StatusBadge status={row.status} /> },
                { id: 'risk', header: 'Risk', accessor: (row) => <DecisionBadge decision={row.assessmentDecision} /> },
                {
                  id: 'discount',
                  header: 'Blended',
                  accessor: (row) => formatPercent(row.blendedDiscountPercent),
                },
                {
                  id: 'owner',
                  header: 'Owner',
                  accessor: (row) => ownerLabel(row.ownerId, user?.id, user?.displayName),
                },
                { id: 'updated', header: 'Updated', accessor: (row) => formatDate(row.updatedAt) },
              ]}
            />
            <div className="mt-4">
              <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />
            </div>
          </>
        ) : null}
      </PageContainer>
    </DealflowGate>
  );
}
