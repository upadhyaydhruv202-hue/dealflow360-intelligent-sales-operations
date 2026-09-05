import type { ReactNode } from 'react';

import { ResponsiveGrid } from '../layout/PageContainer';

export interface DashboardLayoutProps {
  kpis?: ReactNode;
  charts?: ReactNode;
  activity?: ReactNode;
  notifications?: ReactNode;
  table?: ReactNode;
}

export function DashboardLayout({ kpis, charts, activity, notifications, table }: DashboardLayoutProps) {
  return (
    <div className="space-y-6">
      {kpis ? <ResponsiveGrid columns={4}>{kpis}</ResponsiveGrid> : null}
      {charts ? <div className="grid gap-4 lg:grid-cols-2">{charts}</div> : null}
      {activity || notifications ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {activity}
          {notifications}
        </div>
      ) : null}
      {table}
    </div>
  );
}
