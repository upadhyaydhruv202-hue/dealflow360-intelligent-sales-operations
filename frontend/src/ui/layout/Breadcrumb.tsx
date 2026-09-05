import { Link, useInRouterContext } from 'react-router-dom';
import type { ReactNode } from 'react';

import { cn } from '../cn';

export interface BreadcrumbItem {
  label: ReactNode;
  to?: string;
}

function BreadcrumbLink({ to, children }: { to: string; children: ReactNode }) {
  const inRouter = useInRouterContext();
  const className = 'hover:text-foreground';
  if (inRouter) {
    return (
      <Link className={className} to={to}>
        {children}
      </Link>
    );
  }
  return (
    <a className={className} href={to}>
      {children}
    </a>
  );
}

export function Breadcrumb({ items, className }: { items: BreadcrumbItem[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={cn('text-xs text-foreground-muted', className)}>
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li key={`${item.to ?? ''}-${index}`} className="flex items-center gap-1">
              {index > 0 ? <span aria-hidden>/</span> : null}
              {item.to && !last ? (
                <BreadcrumbLink to={item.to}>{item.label}</BreadcrumbLink>
              ) : (
                <span className={last ? 'font-medium text-foreground' : undefined} aria-current={last ? 'page' : undefined}>
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
