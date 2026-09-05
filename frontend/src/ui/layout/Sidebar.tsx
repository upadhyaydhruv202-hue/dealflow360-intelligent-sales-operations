import { NavLink } from 'react-router-dom';
import type { ReactNode } from 'react';

import { cn } from '../cn';
import { focusRing } from '../styles';

export interface SidebarProps {
  brand: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ brand, children, footer, open, onClose }: SidebarProps) {
  return (
    <>
      <button
        type="button"
        className={cn(
          'fixed inset-0 z-30 bg-slate-950/40 lg:hidden',
          open ? 'block' : 'hidden',
        )}
        aria-label="Close navigation"
        onClick={onClose}
      />
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-edge bg-surface-elevated transition-transform lg:static lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="border-b border-edge px-4 py-4 text-sm font-semibold tracking-tight text-foreground">
          {brand}
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Primary">
          {children}
        </nav>
        {footer ? <div className="border-t border-edge p-3">{footer}</div> : null}
      </aside>
    </>
  );
}

export function SidebarNavLink({
  to,
  children,
  end,
  onNavigate,
}: {
  to: string;
  children: ReactNode;
  end?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'flex items-center rounded-lg px-3 py-2 text-sm',
          focusRing,
          isActive ? 'bg-surface-muted font-medium text-foreground' : 'text-foreground-muted hover:bg-surface-muted hover:text-foreground',
        )
      }
    >
      {children}
    </NavLink>
  );
}
