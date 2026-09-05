import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../auth/AuthProvider';
import { remapLoginError } from '../auth/login-errors';
import { useOptionalFeatures } from '../features';
import { homePathForUser } from '../lib/rbac';
import { Badge, Button, Card, CardDescription, CardHeader, CardTitle } from '../ui';
import { LoginForm } from '../ui/auth/LoginForm';
import { useTheme } from '../ui/theme/ThemeProvider';

const DEMO_ACCOUNTS = [
  { role: 'Sales rep', email: 'demo.staff@example.com', note: 'Create quotes, submit, fulfill, bill' },
  { role: 'Sales manager', email: 'demo.manager@example.com', note: 'First approval step' },
  { role: 'Admin / finance', email: 'demo.admin@example.com', note: 'Remaining approvals and catalog' },
  { role: 'Customer', email: 'demo.user@example.com', note: 'Customer account page and portal — not the staff dashboard' },
] as const;

export function LoginPage() {
  const { login, pending, error, isAuthenticated, user } = useAuth();
  const features = useOptionalFeatures();
  const navigate = useNavigate();
  const { resolvedTheme, toggleTheme } = useTheme();
  const [email, setEmail] = useState('');
  const demoMode = features?.isDemo() === true;

  useEffect(() => {
    if (isAuthenticated) {
      navigate(homePathForUser(user), { replace: true });
    }
  }, [isAuthenticated, navigate, user]);

  const displayError = remapLoginError(error, demoMode);

  return (
    <div className="min-h-screen bg-surface text-foreground">
      <header className="flex items-center justify-between border-b border-edge px-6 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground-muted">DealFlow360</p>
          <h1 className="text-lg font-semibold">Sales operations sign-in</h1>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={toggleTheme}
          aria-label={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {resolvedTheme === 'dark' ? 'Light' : 'Dark'}
        </Button>
      </header>
      <main className="mx-auto grid max-w-4xl gap-8 px-6 py-10 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        {isAuthenticated ? (
          <p className="text-sm text-foreground-muted">Redirecting…</p>
        ) : (
          <>
            <div>
              <p className="mb-4 text-sm text-foreground-muted">
                {demoMode
                  ? 'Use a seeded demo account. The password is checked. This is not a passwordless shortcut.'
                  : 'Sign in with an account issued by the API.'}
              </p>
              <LoginForm
                loading={pending}
                error={displayError}
                emailValue={email}
                onEmailChange={setEmail}
                hint={demoMode ? 'Password for all seeded accounts: demo-password' : undefined}
                onSubmit={({ email: nextEmail, password }) => login(nextEmail, password)}
              />
            </div>
            {demoMode ? (
              <Card>
                <CardHeader>
                  <div>
                    <CardTitle>Demo roles</CardTitle>
                    <CardDescription>Click a role to fill the email. You still enter the password and sign in.</CardDescription>
                  </div>
                </CardHeader>
                <ul className="space-y-3">
                  {DEMO_ACCOUNTS.map((account) => (
                    <li key={account.email}>
                      <button
                        type="button"
                        className="w-full rounded-lg border border-edge px-3 py-2 text-left hover:bg-surface-muted"
                        onClick={() => setEmail(account.email)}
                      >
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <Badge tone="accent">{account.role}</Badge>
                          <span className="text-xs text-foreground-muted">Use email</span>
                        </div>
                        <p className="text-sm font-medium">{account.email}</p>
                        <p className="text-xs text-foreground-muted">{account.note}</p>
                      </button>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}
