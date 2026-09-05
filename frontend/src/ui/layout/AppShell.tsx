import { useState, type ReactNode } from 'react';

import { cn } from '../cn';
import { CommandPalette, useCommandPalette } from '../command/CommandPalette';
import { useIsDesktop } from '../hooks';
import { railGroups } from '../../layouts/nav';
import { Drawer } from '../overlays/Drawer';
import { BrandMark, MobileBottomNav, NavigationRail, RailLink } from './NavigationRail';
import { Topbar } from './Topbar';

export interface AppShellProps {
  brand: ReactNode;
  navigation?: ReactNode;
  sidebarFooter?: ReactNode;
  topbarStart?: ReactNode;
  topbarEnd?: ReactNode;
  children: ReactNode;
}

export function AppShell({ brand, navigation, sidebarFooter, topbarStart, topbarEnd, children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [hovered, setHovered] = useState(false);
  const { open: commandOpen, setOpen: setCommandOpen } = useCommandPalette();
  const isDesktop = useIsDesktop();
  const mobileGroups = railGroups();

  return (
    <div className="min-h-screen bg-surface text-foreground">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface-elevated focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <div className="flex min-h-screen">
        {isDesktop ? (
          <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
            <NavigationRail
              brand={brand}
              expanded={expanded || hovered}
              onToggle={() => setExpanded((current) => !current)}
              footer={sidebarFooter}
            >
              {navigation}
            </NavigationRail>
          </div>
        ) : null}
        <div className={cn('flex min-w-0 flex-1 flex-col', !isDesktop && 'pb-16')}>
          <Topbar
            start={topbarStart}
            end={topbarEnd}
            onMenuClick={() => setSidebarOpen(true)}
            onCommandClick={() => setCommandOpen(true)}
          />
          <main id="main-content" className="df-page-enter min-w-0 flex-1">
            {children}
          </main>
        </div>
      </div>
      {isDesktop ? null : <MobileBottomNav onMore={() => setSidebarOpen(true)} />}
      <Drawer open={sidebarOpen} onClose={() => setSidebarOpen(false)} title={brand} side="left">
        <div className="mb-4 flex items-center gap-2">
          <BrandMark />
          <p className="text-sm font-semibold">{brand}</p>
        </div>
        <div className="space-y-5" onClick={() => setSidebarOpen(false)}>
          {mobileGroups.map((group) => (
            <div key={group.id}>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground-muted">
                {group.label}
              </p>
              <div className="space-y-1">
                {group.items.map((item) => (
                  <RailLink key={item.to} item={item} expanded onNavigate={() => setSidebarOpen(false)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </Drawer>
      <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} />
    </div>
  );
}
