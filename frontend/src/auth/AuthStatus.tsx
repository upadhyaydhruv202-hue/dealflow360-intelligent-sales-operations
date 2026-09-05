import { Link } from 'react-router-dom';

import { useAuth } from './AuthProvider';
import { Button } from '../ui';

export function AuthStatus() {
  const { user, isAuthenticated, logout, pending } = useAuth();

  if (!isAuthenticated) {
    return (
      <Link
        to="/login"
        className="rounded-lg px-2 py-1 text-xs font-medium text-foreground hover:bg-surface-muted"
      >
        Sign in
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="hidden max-w-[10rem] truncate text-xs text-foreground-muted sm:inline">
        {user?.displayName ?? user?.email}
      </span>
      <Button variant="ghost" size="sm" loading={pending} onClick={() => void logout()}>
        Sign out
      </Button>
    </div>
  );
}
