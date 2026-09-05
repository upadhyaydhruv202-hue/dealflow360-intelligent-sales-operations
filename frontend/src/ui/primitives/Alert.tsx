import type { HTMLAttributes, ReactNode } from 'react';

import { cn } from '../cn';
import { Button } from './Button';

export type AlertVariant = 'info' | 'success' | 'warning' | 'error';

export interface AlertProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  variant?: AlertVariant;
  title?: ReactNode;
  onDismiss?: () => void;
  children?: ReactNode;
}

const variantClass: Record<AlertVariant, string> = {
  info: 'border-info/30 bg-info/10 text-foreground',
  success: 'border-success/30 bg-success/10 text-foreground',
  warning: 'border-warning/30 bg-warning/10 text-foreground',
  error: 'border-danger/30 bg-danger/10 text-foreground',
};

export function Alert({ variant = 'info', title, onDismiss, className, children, ...props }: AlertProps) {
  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={cn('rounded-xl border px-4 py-3 text-sm', variantClass[variant], className)}
      {...props}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          {title ? <p className="font-semibold">{title}</p> : null}
          {children ? <div className="text-foreground-muted">{children}</div> : null}
        </div>
        {onDismiss ? (
          <Button variant="ghost" size="sm" aria-label="Dismiss" onClick={onDismiss} className="h-7 px-2">
            ×
          </Button>
        ) : null}
      </div>
    </div>
  );
}
