import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '@/auth/AuthProvider';
import { getApiErrorMessage } from '@/services/api';
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

import { disposeAnomaly, listAnomalies } from './api';
import { DealflowGate } from './components';
import { useDealflowRealtime } from './hooks';

type Tab = 'open' | 'acknowledged' | 'resolved' | 'dismissed';

interface AnomalyRow {
  id: string;
  type: string;
  severity: string;
  entityType: string;
  entityId: string;
  quoteId?: string | null;
  description: string;
  status: string;
  resolution?: string | null;
  detectedAt: string;
}

export function AnomalyCenterPage() {
  const { accessToken } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState<AnomalyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [tab, setTab] = useState<Tab>('open');

  const reload = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      setRows(await listAnomalies(accessToken));
      setError(undefined);
    } catch (caught) {
      setError(getApiErrorMessage(caught, 'Could not load anomalies.'));
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useDealflowRealtime(accessToken, () => {
    if (!accessToken) return;
    void listAnomalies(accessToken)
      .then((items) => {
        setRows(items);
        setError(undefined);
      })
      .catch((caught) => {
        setError(getApiErrorMessage(caught, 'Could not load anomalies.'));
      });
  });

  const visible = useMemo(() => rows.filter((item) => item.status === tab), [rows, tab]);

  async function setDisposition(id: string, status: Tab) {
    if (!accessToken) return;
    try {
      const next = await disposeAnomaly(id, { status }, accessToken);
      setRows((current) => current.map((item) => (item.id === id ? { ...item, ...next } : item)));
      toast({ title: `Anomaly ${status}`, variant: 'success' });
    } catch (caught) {
      toast({ title: getApiErrorMessage(caught, 'Disposition failed'), variant: 'error' });
    }
  }

  return (
    <DealflowGate permission="dealflow.quotes.read">
      <PageContainer
        width="wide"
        breadcrumb={<Breadcrumb items={[{ label: 'Dashboard', to: '/dealflow' }, { label: 'Anomalies' }]} />}
        title="Anomaly center"
        description="Persisted DealFlow exceptions from live quotations. Disposition is stored in PostgreSQL and audited."
      >
        {loading ? <LoadingState label="Loading anomalies…" /> : null}
        {error ? <ErrorState message={error} onRetry={() => void reload()} /> : null}
        {!loading && !error ? (
          <Tabs
            value={tab}
            onChange={(id) => setTab(id as Tab)}
            items={(
              [
                ['open', 'Open'],
                ['acknowledged', 'Acknowledged'],
                ['resolved', 'Resolved'],
                ['dismissed', 'Dismissed'],
              ] as const
            ).map(([id, label]) => ({
              id,
              label: `${label} (${rows.filter((item) => item.status === id).length})`,
              content:
                visible.length === 0 ? (
                  <EmptyState title="No anomalies in this state" />
                ) : (
                  <DataTable
                    caption={`${label} anomalies`}
                    rowId={(row) => row.id}
                    rows={visible}
                    columns={[
                      { id: 'severity', header: 'Severity', accessor: (row) => <Badge tone={row.severity === 'critical' ? 'danger' : 'warning'}>{row.severity}</Badge> },
                      { id: 'type', header: 'Type', accessor: (row) => row.type.replaceAll('_', ' ') },
                      { id: 'description', header: 'Description', accessor: (row) => row.description },
                      {
                        id: 'quote',
                        header: 'Quote',
                        accessor: (row) =>
                          row.quoteId ? (
                            <Link className="text-accent hover:underline" to={`/dealflow/quotes/${row.quoteId}`}>
                              Open
                            </Link>
                          ) : (
                            '—'
                          ),
                      },
                      {
                        id: 'actions',
                        header: '',
                        accessor: (row) => (
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant="ghost" onClick={() => void setDisposition(row.id, 'acknowledged')}>
                              Acknowledge
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => void setDisposition(row.id, 'resolved')}>
                              Resolve
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => void setDisposition(row.id, 'dismissed')}>
                              Dismiss
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => void setDisposition(row.id, 'open')}>
                              Reopen
                            </Button>
                          </div>
                        ),
                      },
                    ]}
                  />
                ),
            }))}
          />
        ) : null}
      </PageContainer>
    </DealflowGate>
  );
}
