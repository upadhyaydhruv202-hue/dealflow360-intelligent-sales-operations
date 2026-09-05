import { useMemo, useState } from 'react';

import { useAuth } from '../auth/AuthProvider';
import { useOptionalFeatures } from '../features';
import { useRealtime } from '../hooks/useRealtime';

import {
  ActivityFeed,
  Breadcrumb,
  ChartArea,
  DashboardLayout,
  DataTable,
  KpiCard,
  NotificationPanel,
  PageContainer,
  Pagination,
  SimpleBarChart,
  SimpleLineChart,
  TableSection,
} from '../ui';

const SAMPLE_ROWS = [
  { id: '1', name: 'Sample record A', status: 'Ready', owner: 'Team' },
  { id: '2', name: 'Sample record B', status: 'Queued', owner: 'Ops' },
  { id: '3', name: 'Sample record C', status: 'Review', owner: 'Team' },
];

export function DashboardPage() {
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ id: string; direction: 'asc' | 'desc' }>({ id: 'name', direction: 'asc' });
  const [notices, setNotices] = useState([
    { id: 'n1', title: 'Sample notice', body: 'Replace this feed with your notification service.', unread: true, timestamp: 'Just now' },
    { id: 'n2', title: 'System placeholder', body: 'No product data is hardcoded in the layout components.', unread: false, timestamp: 'Earlier' },
  ]);
  const [live, setLive] = useState<Array<{ id: string; title: string; description: string; timestamp: string }>>([]);
  const { accessToken } = useAuth();
  const features = useOptionalFeatures();
  const liveEnabled = Boolean(accessToken) && features?.isEnabled('realtime') === true;

  useRealtime({
    token: accessToken,
    channels: ['dashboard'],
    enabled: liveEnabled,
    onEvent: (event) => {
      setLive((current) =>
        [
          {
            id: event.id,
            title: event.type,
            description: `${event.channel} update`,
            timestamp: 'now',
          },
          ...current,
        ].slice(0, 8),
      );
    },
  });

  const sortedRows = useMemo(() => {
    const copy = [...SAMPLE_ROWS];
    copy.sort((left, right) => {
      const key = sort.id as keyof (typeof SAMPLE_ROWS)[number];
      const a = String(left[key] ?? '');
      const b = String(right[key] ?? '');
      return sort.direction === 'asc' ? a.localeCompare(b) : b.localeCompare(a);
    });
    return copy;
  }, [sort]);

  return (
    <PageContainer
      width="wide"
      breadcrumb={<Breadcrumb items={[{ label: 'Home', to: '/' }, { label: 'Dashboard' }]} />}
      title="Dashboard"
      description="Slot-based layout for KPIs, charts, activity, notices, and tables. Pass your own data; the sample values below are placeholders."
    >
      <DashboardLayout
        kpis={
          <>
            <KpiCard label="Primary metric" value="1,284" delta={{ label: '+12%', trend: 'up' }} hint="Replace" />
            <KpiCard label="Secondary metric" value="86%" delta={{ label: 'stable', trend: 'flat' }} hint="Replace" />
            <KpiCard label="Queued work" value="24" delta={{ label: '-3', trend: 'down' }} hint="Replace" />
            <KpiCard label="Attention" value="3" hint="Replace with your count" />
          </>
        }
        charts={
          <>
            <ChartArea title="Volume" description="SVG bar chart. Data is passed in; this is placeholder.">
              <SimpleBarChart
                title="Volume"
                data={[
                  { label: 'Bucket A', value: 42 },
                  { label: 'Bucket B', value: 28 },
                  { label: 'Bucket C', value: 19 },
                ]}
              />
            </ChartArea>
            <ChartArea title="Trend" description="SVG line chart. Swap the slot if you need a charting library.">
              <SimpleLineChart
                title="Trend"
                data={[
                  { label: 'Mon', value: 12 },
                  { label: 'Tue', value: 18 },
                  { label: 'Wed', value: 9 },
                  { label: 'Thu', value: 22 },
                ]}
              />
            </ChartArea>
          </>
        }
        activity={
          <ActivityFeed
            items={[
              ...live,
              { id: 'a1', title: 'Placeholder event', description: 'Wire this list to your audit or activity API.', timestamp: '2m' },
              { id: 'a2', title: 'Another event', description: 'Keep domain names out of the reusable layout.', timestamp: '1h' },
            ]}
          />
        }
        notifications={
          <NotificationPanel
            items={notices}
            onRead={(id) => setNotices((current) => current.map((item) => (item.id === id ? { ...item, unread: false } : item)))}
          />
        }
        table={
          <TableSection title="Records" description="Generic table section. Columns and rows come from the page.">
            <DataTable
              caption="Sample records"
              columns={[
                { id: 'name', header: 'Name', accessor: 'name', sortable: true },
                { id: 'status', header: 'Status', accessor: 'status', sortable: true },
                { id: 'owner', header: 'Owner', accessor: 'owner' },
              ]}
              rows={sortedRows}
              rowId={(row) => row.id}
              sort={sort}
              onSortChange={setSort}
            />
            <div className="mt-4">
              <Pagination page={page} pageSize={10} total={SAMPLE_ROWS.length} onPageChange={setPage} />
            </div>
          </TableSection>
        }
      />
    </PageContainer>
  );
}
