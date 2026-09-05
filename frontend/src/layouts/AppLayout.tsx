import { Outlet } from 'react-router-dom';

import { AuthStatus } from '../auth/AuthStatus';
import { problemNav } from '../problem';
import { AppShell, SidebarNavLink } from '../ui';

export function AppLayout() {
  return (
    <AppShell
      brand="DealFlow360"
      topbarEnd={<AuthStatus />}
      navigation={problemNav.map((item) => (
        <SidebarNavLink key={item.to} to={item.to} end={item.end}>
          {item.label}
        </SidebarNavLink>
      ))}
    >
      <Outlet />
    </AppShell>
  );
}
