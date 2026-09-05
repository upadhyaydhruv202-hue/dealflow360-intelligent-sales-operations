import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '@/auth/AuthProvider';
import {
  Badge,
  Breadcrumb,
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  LoadingState,
  PageContainer,
  Tabs,
  useToast,
} from '@/ui';

import { DealflowGate } from './components';
import { formatMoney } from './format';
import { useCatalog, useQuotes } from './hooks';
import {
  detectAnomalies,
  healthTone,
  loadAnomalyDispositions,
  saveAnomalyDisposition,
  type AnomalyDisposition,
  type DealAnomaly,
} from './intelligence';

interface AnomalyRow extends DealAnomaly {
  disposition: AnomalyDisposition;
}

export function AnomalyCenterPage() {
  const { accessToken } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const quotes = useQuotes(accessToken);
  const catalog = useCatalog(accessToken);
  const [dispositions, setDispositions] = useState(loadAnomalyDispositions);
  const [tab, setTab] = useState<AnomalyDisposition>('open');

  const rows = useMemo<AnomalyRow[]>(() => {
    return detectAnomalies(quotes.data ?? [], catalog.data).map((item) => ({
      ...item,
      disposition: dispositions[item.id] ?? 'open',
    }));
  }, [catalog.data, dispositions, quotes.data]);

  const visible = rows.filter((item) => item.disposition === tab);

  function setDisposition(id: string, disposition: AnomalyDisposition) {
    setDispositions(saveAnomalyDisposition(id, disposition));
    toast({
      title: disposition === 'resolved' ? 'Anomaly resolved' : disposition === 'ignored' ? 'Anomaly ignored' : 'Reopened',
      variant: 'success',
    });
  }

  return (
    <DealflowGate permission="dealflow.quotes.read">
      <PageContainer
        width="wide"
        breadcrumb={<Breadcrumb items={[{ label: 'Dashboard', to: '/dealflow' }, { label: 'Anomalies' }]} />}
        title="Anomaly center"
        description="Operational exceptions derived from live quotations, stock, and approval age. These are not kit FEATURE_ANOMALY scores."
      >
        {quotes.loading ? <LoadingState label="Scanning the book…" /> : null}
        {quotes.error ? <ErrorState message={quotes.error} onRetry={() => void quotes.reload()} /> : null}
        {!quotes.loading && !quotes.error ? (
          <Tabs
            value={tab}
            onChange={(id) => setTab(id as AnomalyDisposition)}
            items={(
              [
                ['open', 'Open'],
                ['resolved', 'Resolved'],
                ['ignored', 'Ignored'],
              ] as const
            ).map(([id, label]) => ({
              id,
              label: `${label} (${rows.filter((item) => item.disposition === id).length})`,
              content:
                visible.length === 0 ? (
                  <EmptyState
                    title={tab === 'open' ? 'No open anomalies' : `No ${tab} anomalies`}
                    description={
                      tab === 'open'
                        ? 'Live quotes are currently within policy, stock, and approval SLAs.'
                        : 'Move an open item here after you investigate it.'
                    }
                  />
                ) : (
                  <DataTable<AnomalyRow>
                    caption="Detected anomalies"
                    rowId={(row) => row.id}
                    rows={visible}
                    onRowClick={(row) => navigate(row.href)}
                    columns={[
                      {
                        id: 'severity',
                        header: 'Severity',
                        accessor: (row) => (
                          <Badge tone={healthTone(row.severity)}>{row.severity}</Badge>
                        ),
                      },
                      {
                        id: 'deal',
                        header: 'Deal',
                        accessor: (row) => (
                          <Link className="font-medium hover:underline" to={`/dealflow/quotes/${row.quoteId}`}>
                            {row.quoteNumber}
                          </Link>
                        ),
                      },
                      { id: 'customer', header: 'Customer', accessor: (row) => row.customerName },
                      { id: 'title', header: 'Detection', accessor: (row) => row.title },
                      { id: 'reason', header: 'Reason', accessor: (row) => row.reason },
                      { id: 'impact', header: 'Financial impact', accessor: (row) => row.impact },
                      { id: 'action', header: 'Recommended action', accessor: (row) => row.action },
                      {
                        id: 'ops',
                        header: 'Investigate',
                        accessor: (row) => (
                          <div className="flex flex-wrap gap-2" onClick={(event) => event.stopPropagation()}>
                            <Button size="sm" variant="outline" onClick={() => navigate(row.href)}>
                              Open
                            </Button>
                            {tab === 'open' ? (
                              <>
                                <Button size="sm" variant="outline" onClick={() => setDisposition(row.id, 'resolved')}>
                                  Resolve
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setDisposition(row.id, 'ignored')}>
                                  Ignore
                                </Button>
                              </>
                            ) : (
                              <Button size="sm" variant="ghost" onClick={() => setDisposition(row.id, 'open')}>
                                Reopen
                              </Button>
                            )}
                          </div>
                        ),
                      },
                    ]}
                  />
                ),
            }))}
          />
        ) : null}
        <p className="mt-6 text-caption text-foreground-muted">
          Resolve and ignore stay in this browser session so the demo queue stays usable. Totals still come from{' '}
          {formatMoney((quotes.data ?? []).reduce((sum, item) => sum + item.netTotal, 0))} of live quote value.
        </p>
      </PageContainer>
    </DealflowGate>
  );
}
