import type { ReactNode } from 'react';

export interface DashboardLayoutProps {
  kpis?: ReactNode;
  charts?: ReactNode;
  activity?: ReactNode;
  notifications?: ReactNode;
  table?: ReactNode;
}

export function DashboardLayout({ kpis, charts, activity, notifications, table }: DashboardLayoutProps) {
  return (
    <div className="space-y-10">
      {kpis ? (
        <div className="grid gap-6 border-y border-edge py-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          {kpis}
        </div>
      ) : null}
      {charts ? <div className="grid gap-10 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">{charts}</div> : null}
      {activity || notifications ? (
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          {activity}
          {notifications}
        </div>
      ) : null}
      {table}
    </div>
  );
}
