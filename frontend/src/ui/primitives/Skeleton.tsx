import type { HTMLAttributes } from 'react';

import { cn } from '../cn';

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  lines?: number;
}

export function Skeleton({ className, lines, ...props }: SkeletonProps) {
  if (lines && lines > 1) {
    return (
      <div className="space-y-2" {...props}>
        {Array.from({ length: lines }, (_, index) => (
          <div
            key={index}
            className={cn('h-3 animate-pulse rounded-md bg-surface-muted motion-reduce:animate-none', className)}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn('h-4 animate-pulse rounded-md bg-surface-muted motion-reduce:animate-none', className)}
      {...props}
    />
  );
}
