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
  const { isAuthenticated, login, pending, error } = useAuth();

  if (!isAuthenticated) {
    return (
      <Card className="max-w-md">
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
