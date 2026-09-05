import { Outlet } from 'react-router-dom';

import { AppShell } from '../ui';

export function AppLayout() {
  return (
    <AppShell brand="DealFlow360">
      <Outlet />
    </AppShell>
  );
}
