import type { HTMLAttributes, ReactNode } from 'react';

import { cn } from '../cn';

export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'accent';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  children: ReactNode;
}

const toneClass: Record<BadgeTone, string> = {
  neutral: 'bg-surface-muted text-foreground',
  info: 'bg-info/15 text-info',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  danger: 'bg-danger/15 text-danger',
  accent: 'bg-accent/10 text-foreground',
};

export function Badge({ tone = 'neutral', className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
        toneClass[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
