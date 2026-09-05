import { CircleHelp, Moon, Search, SunMedium } from 'lucide-react';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

import { breadcrumbForPath } from '../../layouts/nav';
import { cn } from '../cn';
import { Button } from '../primitives/Button';
import { useTheme } from '../theme/ThemeProvider';
import { Breadcrumb } from './Breadcrumb';
import { AccountMenu } from './AccountMenu';
import { NotificationDrawer } from './NotificationDrawer';
import { focusRing } from '../styles';

export interface TopbarProps {
  title?: ReactNode;
  start?: ReactNode;
  end?: ReactNode;
  onMenuClick?: () => void;
  onCommandClick?: () => void;
  className?: string;
}

export function Topbar({ title, start, end, onMenuClick, onCommandClick, className }: TopbarProps) {
  const { resolvedTheme, toggleTheme } = useTheme();
  const location = useLocation();
  const crumbs = breadcrumbForPath(location.pathname);

  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-edge bg-surface-elevated/90 px-3 backdrop-blur-md sm:px-5',
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {onMenuClick ? (
          <Button variant="ghost" size="sm" className="lg:hidden" aria-label="Open navigation" onClick={onMenuClick}>
            Menu
          </Button>
        ) : null}
        <div className="min-w-0">
          {start}
          {title ? <p className="truncate text-sm font-semibold text-foreground">{title}</p> : null}
          {!title && crumbs.length ? <Breadcrumb items={crumbs} className="hidden sm:flex" /> : null}
        </div>
      </div>
      <button
        type="button"
        onClick={onCommandClick}
        className={cn(
          'hidden h-9 min-w-[280px] max-w-md items-center gap-3 rounded-full border border-edge bg-surface-muted px-3 text-left text-sm text-foreground-muted transition-colors duration-df hover:border-foreground/20 hover:bg-surface md:flex',
          focusRing,
        )}
        aria-label="Open command palette"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="flex-1">Search anything...</span>
        <kbd className="rounded-md border border-edge bg-surface-elevated px-1.5 py-0.5 text-[10px] text-foreground-muted">
          ⌘K
        </kbd>
      </button>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          className={cn(
            'rounded-control p-2 text-foreground-muted hover:bg-surface-muted hover:text-foreground md:hidden',
            focusRing,
          )}
          aria-label="Open command palette"
          onClick={onCommandClick}
        >
          <Search className="h-4 w-4" />
        </button>
        <NotificationDrawer />
        <button
          type="button"
          className={cn(
            'hidden rounded-control p-2 text-foreground-muted hover:bg-surface-muted hover:text-foreground sm:inline-flex',
            focusRing,
          )}
          aria-label="Help"
          onClick={onCommandClick}
        >
          <CircleHelp className="h-4 w-4" />
        </button>
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleTheme}
          aria-label={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="px-2"
        >
          {resolvedTheme === 'dark' ? <SunMedium className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          <span className="sr-only">{resolvedTheme === 'dark' ? 'Light' : 'Dark'}</span>
        </Button>
        {end ?? <AccountMenu onShortcuts={onCommandClick} />}
      </div>
    </header>
  );
}
