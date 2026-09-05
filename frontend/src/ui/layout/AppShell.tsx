import { useState, type ReactNode } from 'react';

import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export interface AppShellProps {
  brand: ReactNode;
  navigation: ReactNode;
  sidebarFooter?: ReactNode;
  topbarStart?: ReactNode;
  topbarEnd?: ReactNode;
  children: ReactNode;
}

export function AppShell({ brand, navigation, sidebarFooter, topbarStart, topbarEnd, children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-surface text-foreground">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface-elevated focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <div className="flex min-h-screen">
        <Sidebar brand={brand} open={sidebarOpen} onClose={() => setSidebarOpen(false)} footer={sidebarFooter}>
          <div onClick={() => setSidebarOpen(false)}>{navigation}</div>
        </Sidebar>
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar start={topbarStart} end={topbarEnd} onMenuClick={() => setSidebarOpen(true)} />
          <main id="main-content" className="min-w-0 flex-1">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
