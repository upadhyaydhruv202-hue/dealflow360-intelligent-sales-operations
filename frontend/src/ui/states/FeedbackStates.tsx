import type { ReactNode } from 'react';

import { cn } from '../cn';
import { Button } from '../primitives/Button';

export interface EmptyStateProps {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('px-6 py-12 text-center', className)}>
      <div className="mx-auto mb-4 h-12 w-12 rounded-full border border-dashed border-edge" aria-hidden />
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description ? <p className="mx-auto mt-1 max-w-md text-sm text-foreground-muted">{description}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export interface ErrorStateProps {
  title?: string;
  message: ReactNode;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({ title = 'Something went wrong', message, onRetry, className }: ErrorStateProps) {
  return (
    <div role="alert" className={cn('rounded-panel border border-danger/20 bg-danger/5 px-6 py-8 text-center', className)}>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-sm text-foreground-muted">{message}</p>
      {onRetry ? (
        <div className="mt-4 flex justify-center">
          <Button variant="outline" onClick={onRetry}>
            Retry
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export interface LoadingStateProps {
  label?: string;
  className?: string;
}

export function LoadingState({ label = 'Loading…', className }: LoadingStateProps) {
  return (
    <div className={cn('space-y-3 px-1 py-6', className)} role="status">
      <div className="df-shimmer h-10 rounded-control" />
      <div className="df-shimmer h-24 rounded-panel" />
      <div className="df-shimmer h-24 rounded-panel" />
      <span className="sr-only">{label}</span>
      <p className="text-sm text-foreground-muted">{label}</p>
    </div>
  );
}
