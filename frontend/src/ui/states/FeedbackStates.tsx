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
    <div className={cn('rounded-xl border border-dashed border-edge px-6 py-10 text-center', className)}>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description ? <p className="mt-1 text-sm text-foreground-muted">{description}</p> : null}
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
    <div
      role="alert"
      className={cn('rounded-xl border border-danger/30 bg-danger/10 px-6 py-8 text-center', className)}
    >
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
    <div className={cn('flex items-center justify-center gap-2 px-6 py-10 text-sm text-foreground-muted', className)} role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none" />
      {label}
    </div>
  );
}
