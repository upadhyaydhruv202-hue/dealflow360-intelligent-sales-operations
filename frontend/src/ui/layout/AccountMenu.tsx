import { Link, useNavigate } from 'react-router-dom';
import { Keyboard, LogOut, Moon, Settings, SunMedium, UserRound } from 'lucide-react';

import { useOptionalAuth } from '../../auth/AuthProvider';
import { Dropdown } from '../overlays/Dropdown';
import { useTheme } from '../theme/ThemeProvider';

export function AccountMenu({ onShortcuts }: { onShortcuts?: () => void }) {
  const auth = useOptionalAuth();
  const { resolvedTheme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  if (!auth?.isAuthenticated) {
    return (
      <Link
        to="/login"
        className="rounded-control px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-surface-muted"
      >
        Sign in
      </Link>
    );
  }

  const name = auth.user?.displayName ?? auth.user?.email ?? 'Account';
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <Dropdown
      align="end"
      label="Account menu"
      trigger={
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-[11px] font-semibold text-foreground-inverted"
          aria-label="Account menu"
        >
          {initials || <UserRound className="h-4 w-4" />}
        </button>
      }
      items={[
        {
          id: 'identity',
          label: (
            <span className="block">
              <span className="block text-sm font-medium">{name}</span>
              <span className="block text-caption text-foreground-muted">{auth.user?.email}</span>
            </span>
          ),
        },
        {
          id: 'workspace',
          label: 'Workspace · DealFlow360',
        },
        {
          id: 'theme',
          label: (
            <span className="flex items-center gap-2">
              {resolvedTheme === 'dark' ? <SunMedium className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
              {resolvedTheme === 'dark' ? 'Light theme' : 'Dark theme'}
            </span>
          ),
          onSelect: toggleTheme,
        },
        {
          id: 'shortcuts',
          label: (
            <span className="flex items-center gap-2">
              <Keyboard className="h-3.5 w-3.5" />
              Keyboard shortcuts
            </span>
          ),
          onSelect: onShortcuts,
        },
        {
          id: 'settings',
          label: (
            <span className="flex items-center gap-2">
              <Settings className="h-3.5 w-3.5" />
              Notifications & preferences
            </span>
          ),
          onSelect: () => navigate('/notifications'),
        },
        {
          id: 'logout',
          label: (
            <span className="flex items-center gap-2">
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </span>
          ),
          destructive: true,
          onSelect: () => {
            void auth.logout();
          },
        },
      ]}
    />
  );
}
