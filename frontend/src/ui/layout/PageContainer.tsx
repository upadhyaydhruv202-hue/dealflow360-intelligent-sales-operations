import type { HTMLAttributes, ReactNode } from 'react';

import { cn } from '../cn';

export interface PageContainerProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  breadcrumb?: ReactNode;
  width?: 'default' | 'wide' | 'full';
}

const widthClass = {
  default: 'max-w-5xl',
  wide: 'max-w-7xl',
  full: 'max-w-none',
};

export function PageContainer({
  title,
  description,
  actions,
  breadcrumb,
  width = 'default',
  className,
  children,
  ...props
}: PageContainerProps) {
  return (
    <div className={cn('mx-auto w-full px-4 py-6 sm:px-6', widthClass[width], className)} {...props}>
      {breadcrumb ? <div className="mb-3">{breadcrumb}</div> : null}
      {title || actions ? (
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            {title ? <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1> : null}
            {description ? <p className="max-w-2xl text-sm leading-6 text-foreground-muted">{description}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}

export function ResponsiveGrid({
  children,
  columns = 3,
  className,
}: {
  children: ReactNode;
  columns?: 1 | 2 | 3 | 4;
  className?: string;
}) {
  const columnClass = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4',
  }[columns];

  return <div className={cn('grid gap-4', columnClass, className)}>{children}</div>;
}
