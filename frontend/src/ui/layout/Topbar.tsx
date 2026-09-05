import type { ReactNode } from 'react';

import { cn } from '../cn';
import { Button } from '../primitives/Button';
import { useTheme } from '../theme/ThemeProvider';

export interface TopbarProps {
  title?: ReactNode;
  start?: ReactNode;
  end?: ReactNode;
  onMenuClick?: () => void;
  className?: string;
}

export function Topbar({ title, start, end, onMenuClick, className }: TopbarProps) {
  const { resolvedTheme, toggleTheme } = useTheme();

  return (
    <header className={cn('flex items-center justify-between gap-3 border-b border-edge bg-surface-elevated px-4 py-3', className)}>
      <div className="flex min-w-0 items-center gap-2">
        {onMenuClick ? (
          <Button variant="ghost" size="sm" className="lg:hidden" aria-label="Open navigation" onClick={onMenuClick}>
            Menu
          </Button>
        ) : null}
        {start}
        {title ? <p className="truncate text-sm font-semibold text-foreground">{title}</p> : null}
      </div>
      <div className="flex items-center gap-2">
        {end}
        <Button
          variant="outline"
          size="sm"
          onClick={toggleTheme}
          aria-label={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {resolvedTheme === 'dark' ? 'Light' : 'Dark'}
        </Button>
      </div>
    </header>
  );
}
