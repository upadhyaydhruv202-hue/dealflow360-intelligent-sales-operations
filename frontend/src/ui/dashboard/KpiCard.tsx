import type { ReactNode } from 'react';

import { cn } from '../cn';
import { Card, CardDescription, CardHeader, CardTitle } from '../primitives/Card';
import { Skeleton } from '../primitives/Skeleton';

export interface KpiCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  delta?: { label: string; trend?: 'up' | 'down' | 'flat' };
  loading?: boolean;
  className?: string;
}

export function KpiCard({ label, value, hint, delta, loading, className }: KpiCardProps) {
  return (
    <Card className={className}>
      <CardHeader className="mb-2">
        <CardDescription className="uppercase tracking-wide">{label}</CardDescription>
      </CardHeader>
      {loading ? (
        <Skeleton className="h-8 w-24" />
      ) : (
        <p className="text-2xl font-semibold tracking-tight text-foreground">{value}</p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
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
    </Card>
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
    <Card className="min-h-64">
      <CardHeader>
        <div>
          <CardTitle>{title}</CardTitle>
          {description ? <CardDescription className="mt-1">{description}</CardDescription> : null}
        </div>
        {actions}
      </CardHeader>
      {loading ? <Skeleton className="h-40" /> : children ?? empty}
    </Card>
  );
}
