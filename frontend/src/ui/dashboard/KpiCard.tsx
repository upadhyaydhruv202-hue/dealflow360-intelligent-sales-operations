import type { ReactNode } from 'react';

import { cn } from '../cn';
import { Skeleton } from '../primitives/Skeleton';
import { Sparkline } from './SimpleCharts';

export interface KpiCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  delta?: { label: string; trend?: 'up' | 'down' | 'flat' };
  loading?: boolean;
  className?: string;
  sparkline?: number[];
}

export function KpiCard({ label, value, hint, delta, loading, className, sparkline }: KpiCardProps) {
  return (
    <div className={cn('min-w-0 py-1', className)}>
      <p className="text-caption font-medium uppercase tracking-[0.12em] text-foreground-muted">{label}</p>
      {loading ? (
        <Skeleton className="mt-2 h-8 w-24" />
      ) : (
        <p className="mt-2 text-[28px] font-semibold tracking-tight text-foreground">{value}</p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2 text-caption">
        {delta ? (
          <span
            className={cn(
              delta.trend === 'down' && 'text-danger',
              delta.trend === 'up' && 'text-success',
              (!delta.trend || delta.trend === 'flat') && 'text-foreground-muted',
            )}
          >
            {delta.label}
          </span>
        ) : null}
        {hint ? <span className="text-foreground-muted">{hint}</span> : null}
      </div>
      {sparkline?.length ? <div className="mt-3"><Sparkline values={sparkline} /></div> : null}
    </div>
  );
}

export function ChartArea({
  title,
  description,
  actions,
  children,
  empty,
  loading,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  empty?: ReactNode;
  loading?: boolean;
}) {
  return (
    <section className="min-h-64">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-title text-foreground">{title}</h2>
          {description ? <p className="mt-1 text-sm text-foreground-muted">{description}</p> : null}
        </div>
        {actions}
      </div>
      {loading ? <Skeleton className="h-40" /> : children ?? empty}
    </section>
  );
}
