import { useEffect, useMemo, useState } from 'react';

import { SessionGate } from '../auth/SessionGate';
import { useAuth } from '../auth/AuthProvider';
import { getApiErrorMessage } from '../services/api';
import {
  evaluateAnalyticsDashboard,
  exportAnalytics,
  listAnalyticsKpis,
  queryAnalytics,
  type AnalyticsBreakdownRow,
  type AnalyticsDashboardView,
  type AnalyticsKpiSummary,
  type AnalyticsSeriesPoint,
  type AnalyticsSnapshot,
} from '../services/analytics';
import {
  Alert,
  Badge,
  Breadcrumb,
  Button,
  Card,
  CardHeader,
  CardTitle,
  EmptyState,
  FilterPanel,
  KpiCard,
  PageContainer,
  Pagination,
  Select,
  SimpleBarChart,
  SimpleLineChart,
} from '../ui';
import { controlBase, labelClass } from '../ui/styles';

function defaultFrom(): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - 7);
  return date.toISOString();
}

function downloadText(filename: string, content: string, contentType: string) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function AnalyticsPage() {
  const { accessToken } = useAuth();
  const [kpis, setKpis] = useState<AnalyticsKpiSummary[]>([]);
  const [kpi, setKpi] = useState('kit.demo.events');
  const [kind, setKind] = useState<'snapshot' | 'timeseries' | 'breakdown'>('timeseries');
  const [granularity, setGranularity] = useState<'hour' | 'day' | 'week' | 'month'>('day');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(() => new Date().toISOString());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [provider, setProvider] = useState<string>();
  const [snapshot, setSnapshot] = useState<AnalyticsSnapshot>();
  const [points, setPoints] = useState<AnalyticsSeriesPoint[]>([]);
  const [rows, setRows] = useState<AnalyticsBreakdownRow[]>([]);
  const [dashboard, setDashboard] = useState<AnalyticsDashboardView>();
  const [queried, setQueried] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!accessToken) {
      return;
    }
    void listAnalyticsKpis(accessToken)
      .then((result) => {
        setKpis(result.kpis);
        setProvider(result.provider);
        if (result.kpis[0] && !result.kpis.some((item) => item.name === kpi)) {
          setKpi(result.kpis[0].name);
        }
      })
      .catch((caught) => {
        setError(getApiErrorMessage(caught, 'Could not load analytics KPIs'));
      });
  }, [accessToken]);

  const filters = status ? [{ field: 'status', operator: 'eq' as const, value: status }] : undefined;
  const selected = kpis.find((item) => item.name === kpi);

  const chartData = useMemo(
    () =>
      (kind === 'timeseries' ? points : rows).map((item) => ({
        label: 'bucket' in item ? item.bucket.slice(5, 10) : item.key || '(empty)',
        value: item.value,
      })),
    [kind, points, rows],
  );

  async function runQuery(nextPage = 1) {
    if (!accessToken) {
      setError('Sign in to query analytics.');
      return;
    }
    setLoading(true);
    setError(undefined);
    setPage(nextPage);
    try {
      const result = await queryAnalytics(
        {
          kpi,
          kind,
          from,
          to,
          granularity: kind === 'timeseries' ? granularity : undefined,
          groupBy: kind === 'breakdown' ? 'status' : undefined,
          filters,
          page: nextPage,
          pageSize,
        },
        accessToken,
      );
      setProvider(result.provider);
      setSnapshot(result.snapshot);
      setPoints(result.points ?? []);
      setRows(result.rows ?? []);
      setTotal(result.pagination.totalItems);
      setQueried(true);
    } catch (caught) {
      setError(getApiErrorMessage(caught, 'Analytics query failed'));
    } finally {
      setLoading(false);
    }
  }

  async function loadDashboard() {
    if (!accessToken) {
      setError('Sign in to load a dashboard.');
      return;
    }
    setLoading(true);
    setError(undefined);
    try {
      const view = await evaluateAnalyticsDashboard('kit.demo', { from, to, granularity, filters }, accessToken);
      setDashboard(view);
      setProvider(view.provider);
    } catch (caught) {
      setError(getApiErrorMessage(caught, 'Dashboard failed'));
    } finally {
      setLoading(false);
    }
  }

  async function runExport(format: 'csv' | 'json') {
    if (!accessToken) {
      setError('Sign in to export analytics.');
      return;
    }
    try {
      const result = await exportAnalytics(
        {
          kpi,
          kind,
          from,
          to,
          granularity: kind === 'timeseries' ? granularity : undefined,
          groupBy: kind === 'breakdown' ? 'status' : undefined,
          filters,
          format,
        },
        accessToken,
      );
      downloadText(result.filename, result.content, result.contentType);
    } catch (caught) {
      setError(getApiErrorMessage(caught, 'Export failed'));
    }
  }

  return (
    <PageContainer
      breadcrumb={<Breadcrumb items={[{ label: 'Home', to: '/' }, { label: 'Analytics' }]} />}
      title="Analytics"
      description="Reusable KPI aggregations, time-series, dashboards, filters, and exports behind AnalyticsService. Register problem-specific metrics from modules/problem. This is not a warehouse."
    >
      <SessionGate title="Sign in to view analytics" hint="Manager and admin can query, ingest, and export. Staff can query.">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Query</CardTitle>
            {provider ? <Badge tone="neutral">{provider}</Badge> : null}
          </CardHeader>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <Select
              label="KPI"
              value={kpi}
              onChange={(event) => setKpi(event.target.value)}
              options={kpis.map((item) => ({ value: item.name, label: item.name }))}
            />
            <Select
              label="Kind"
              value={kind}
              onChange={(event) => setKind(event.target.value as typeof kind)}
              options={[
                { value: 'snapshot', label: 'Snapshot' },
                { value: 'timeseries', label: 'Time series' },
                { value: 'breakdown', label: 'Breakdown' },
              ]}
            />
            <Select
              label="Granularity"
              value={granularity}
              onChange={(event) => setGranularity(event.target.value as typeof granularity)}
              options={[
                { value: 'hour', label: 'Hour' },
                { value: 'day', label: 'Day' },
                { value: 'week', label: 'Week' },
                { value: 'month', label: 'Month' },
              ]}
            />
            <p className="self-end text-xs text-foreground-muted">
              {kpis.length} KPI{kpis.length === 1 ? '' : 's'} available
              {selected?.aggregation ? ` · ${selected.aggregation}` : ''}
            </p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" onClick={() => void runQuery(1)} disabled={loading}>
              Run query
            </Button>
            <Button type="button" variant="secondary" onClick={() => void loadDashboard()} disabled={loading}>
              Load demo dashboard
            </Button>
            <Button type="button" variant="ghost" onClick={() => void runExport('csv')}>
              Export CSV
            </Button>
            <Button type="button" variant="ghost" onClick={() => void runExport('json')}>
              Export JSON
            </Button>
          </div>
        </Card>

        <FilterPanel
          title="Filters"
          appliedCount={status ? 1 : 0}
          onReset={() => {
            setStatus('');
            void runQuery(1);
          }}
          onApply={() => void runQuery(1)}
        >
          <div>
            <label className={labelClass} htmlFor="analytics-from">
              From (ISO)
            </label>
            <input
              id="analytics-from"
              className={`${controlBase} mt-1`}
              value={from}
              onChange={(event) => setFrom(event.target.value)}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="analytics-to">
              To (ISO)
            </label>
            <input
              id="analytics-to"
              className={`${controlBase} mt-1`}
              value={to}
              onChange={(event) => setTo(event.target.value)}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="analytics-status">
              Status
            </label>
            <select
              id="analytics-status"
              className={`${controlBase} mt-1`}
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">Any</option>
              <option value="open">open</option>
              <option value="closed">closed</option>
            </select>
          </div>
        </FilterPanel>

        {error ? (
          <Alert variant="error" className="mt-6">
            {error}
          </Alert>
        ) : null}

        {snapshot ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <KpiCard label={snapshot.kpi} value={snapshot.value} hint={`${snapshot.samples} samples · ${snapshot.aggregation}`} />
          </div>
        ) : null}

        {dashboard ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {dashboard.widgets
              .filter((widget) => widget.type === 'kpi' && widget.result.snapshot)
              .map((widget) => (
                <KpiCard
                  key={widget.id}
                  label={widget.title}
                  value={widget.result.snapshot?.value ?? 0}
                  hint={`${widget.result.snapshot?.samples ?? 0} samples`}
                />
              ))}
          </div>
        ) : null}

        {chartData.length > 0 ? (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>{kind === 'breakdown' ? 'Breakdown' : 'Time series'}</CardTitle>
            </CardHeader>
            {kind === 'breakdown' ? (
              <SimpleBarChart data={chartData} title="Breakdown" />
            ) : (
              <SimpleLineChart data={chartData} title="Time series" />
            )}
          </Card>
        ) : null}

        {queried && !snapshot && chartData.length === 0 && !error ? (
          <EmptyState className="mt-6" title="No analytics points" description="Widen the range or ingest facts for this KPI." />
        ) : null}

        {queried && total > 0 && kind !== 'snapshot' ? (
          <Pagination
            className="mt-6"
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={(next) => void runQuery(next)}
            onPageSizeChange={(size) => {
              setPageSize(size);
              void runQuery(1);
            }}
          />
        ) : null}
      </SessionGate>
    </PageContainer>
  );
}
