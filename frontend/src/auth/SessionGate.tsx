import type { ReactNode } from 'react';

import { useAuth } from './AuthProvider';
import { Card, CardTitle } from '../ui';
import { LoginForm } from '../ui/auth/LoginForm';

export function SessionGate({
  children,
  title = 'Sign in required',
  hint,
}: {
  children: ReactNode;
  title?: string;
  hint?: string;
}) {
  const { isAuthenticated, ready, login, pending, error } = useAuth();

  if (!ready) {
    return <p className="text-sm text-foreground-muted">Restoring session…</p>;
  }

  if (!isAuthenticated) {
    return (
      <Card className="max-w-md border-0 p-0 shadow-none">
        <CardTitle className="mb-3">{title}</CardTitle>
        <LoginForm
          hint={hint}
          loading={pending}
          error={error}
          onSubmit={({ email, password }) => login(email, password)}
        />
      </Card>
    );
  }

  return children;
}
