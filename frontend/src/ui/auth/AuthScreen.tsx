import type { ReactNode } from 'react';
import { Moon, SunMedium } from 'lucide-react';

import { Button } from '../primitives/Button';
import { useTheme } from '../theme/ThemeProvider';

export function AuthScreen({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const { resolvedTheme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-surface text-foreground lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(28rem,32rem)]">
      <section className="relative hidden overflow-hidden border-r border-edge px-12 py-12 lg:flex lg:flex-col justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-foreground-muted">DealFlow360</p>
        <div className="max-w-md">
          <p className="text-caption text-foreground-muted">Sales operations</p>
          <h1 className="mt-3 text-display">Command the quote-to-cash path from one workspace.</h1>
          <p className="mt-4 text-sm leading-6 text-foreground-muted">
            Live discounts, approval chains, warehouse splits, and customer negotiation — without a generic admin
            template in the way.
          </p>
        </div>
        <p className="text-caption text-foreground-muted">Premium operations console · 2026</p>
      </section>
      <section className="flex min-h-screen flex-col px-6 py-8 sm:px-10">
        <header className="mb-10 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground-muted">DealFlow360</p>
            <h1 className="mt-1 text-lg font-semibold tracking-tight">{title}</h1>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleTheme}
            aria-label={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {resolvedTheme === 'dark' ? <SunMedium className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            <span className="sr-only">{resolvedTheme === 'dark' ? 'Light' : 'Dark'}</span>
          </Button>
        </header>
        <main className="mx-auto w-full max-w-md flex-1">{children}</main>
      </section>
    </div>
  );
}
