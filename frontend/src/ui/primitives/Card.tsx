import type { HTMLAttributes, ReactNode } from 'react';

import { cn } from '../cn';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-panel border border-edge bg-surface-elevated p-5 transition-colors duration-df', className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mb-3 flex items-start justify-between gap-3', className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn('text-sm font-semibold tracking-tight text-foreground', className)} {...props} />;
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-caption text-foreground-muted', className)} {...props} />;
}

export function CardActions({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('flex shrink-0 items-center gap-2', className)}>{children}</div>;
}
