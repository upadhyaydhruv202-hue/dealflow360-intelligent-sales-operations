import { NavLink } from 'react-router-dom';
import type { ReactNode } from 'react';
import { PanelLeft } from 'lucide-react';

import { railGroups, type AppNavItem } from '../../layouts/nav';
import { cn } from '../cn';
import { focusRing } from '../styles';

export function NavigationRail({
  brand,
  expanded,
  onToggle,
  children,
  footer,
}: {
  brand: ReactNode;
  expanded: boolean;
  onToggle: () => void;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  const groups = railGroups();

  return (
    <aside
      className={cn(
        'flex h-screen shrink-0 flex-col border-r border-edge bg-surface-elevated transition-[width] duration-df',
        expanded ? 'w-60' : 'w-[72px]',
      )}
    >
      <div className={cn('flex h-14 items-center border-b border-edge px-3', expanded ? 'justify-between' : 'justify-center')}>
        {expanded ? <div className="min-w-0 truncate text-sm font-semibold tracking-tight">{brand}</div> : <BrandMark />}
        <button
          type="button"
          className={cn('rounded-control p-2 text-foreground-muted hover:bg-surface-muted hover:text-foreground', focusRing)}
          aria-label={expanded ? 'Collapse navigation' : 'Expand navigation'}
          onClick={onToggle}
        >
          <PanelLeft className="h-4 w-4" />
        </button>
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-2 py-4" aria-label="Primary">
        {children ??
          groups.map((group) => (
            <div key={group.id}>
              {expanded ? (
                <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground-muted">
                  {group.label}
                </p>
              ) : (
                <div className="mx-auto mb-2 h-px w-6 bg-edge" />
              )}
              <div className="space-y-1">
                {group.items.map((item) => (
                  <RailLink key={item.to} item={item} expanded={expanded} />
                ))}
              </div>
            </div>
          ))}
      </nav>
      {footer ? <div className="border-t border-edge p-3">{footer}</div> : null}
    </aside>
  );
}

export function RailLink({ item, expanded, onNavigate }: { item: AppNavItem; expanded: boolean; onNavigate?: () => void }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      title={expanded ? undefined : item.label}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'group relative flex items-center rounded-control text-sm transition-colors duration-df',
          expanded ? 'gap-3 px-2.5 py-2' : 'justify-center px-0 py-2.5',
          focusRing,
          isActive ? 'bg-accent/10 font-medium text-foreground' : 'text-foreground-muted hover:bg-surface-muted hover:text-foreground',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive ? <span className="absolute left-0 top-1.5 h-6 w-0.5 rounded-full bg-accent" /> : null}
          <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
          {expanded ? <span className="truncate">{item.label}</span> : <span className="sr-only">{item.label}</span>}
        </>
      )}
    </NavLink>
  );
}

export function BrandMark() {
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-control bg-foreground text-[11px] font-semibold text-foreground-inverted">
      DF
    </span>
  );
}

export function MobileBottomNav({ onMore }: { onMore: () => void }) {
  const groups = railGroups();
  const items = [
    groups[0]?.items[0],
    groups[1]?.items[0],
    groups[1]?.items[1],
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-edge bg-surface-elevated px-2 py-1.5 lg:hidden"
      aria-label="Mobile"
    >
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-1 rounded-control px-2 py-1.5 text-[11px]',
                isActive ? 'text-foreground' : 'text-foreground-muted',
              )
            }
          >
            <Icon className="h-4 w-4" strokeWidth={1.75} />
            {item.label === 'Dashboard' ? 'Home' : item.label === 'Quotations' ? 'Quotes' : item.label}
          </NavLink>
        );
      })}
      <button type="button" className="flex flex-col items-center gap-1 rounded-control px-2 py-1.5 text-[11px] text-foreground-muted" onClick={onMore}>
        <PanelLeft className="h-4 w-4" />
        More
      </button>
    </nav>
  );
}
