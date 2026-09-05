import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Moon, SunMedium } from 'lucide-react';

import { useAuth } from '../auth/AuthProvider';
import { remapLoginError } from '../auth/login-errors';
import { useOptionalFeatures } from '../features';
import { homePathForUser } from '../lib/rbac';
import { Badge, Button } from '../ui';
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
            <h1 className="mt-1 text-lg font-semibold tracking-tight">Sales operations sign-in</h1>
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
        <main className="mx-auto w-full max-w-md flex-1">
          {isAuthenticated ? (
            <p className="text-sm text-foreground-muted">Redirecting…</p>
          ) : (
            <div className="space-y-8">
              <p className="text-sm text-foreground-muted">
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
              {demoMode ? (
                <div>
                  <div className="mb-3">
                    <p className="text-sm font-semibold">Demo roles</p>
                    <p className="text-caption text-foreground-muted">
                      Click a role to fill the email. You still enter the password and sign in.
                    </p>
                  </div>
                  <ul className="divide-y divide-edge">
                    {DEMO_ACCOUNTS.map((account) => (
                      <li key={account.email}>
                        <button
                          type="button"
                          className="w-full py-3 text-left transition-colors duration-df hover:bg-surface-muted/70"
                          onClick={() => setEmail(account.email)}
                        >
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <Badge tone="accent">{account.role}</Badge>
                            <span className="text-caption text-foreground-muted">Use email</span>
                          </div>
                          <p className="text-sm font-medium">{account.email}</p>
                          <p className="text-caption text-foreground-muted">{account.note}</p>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}
        </main>
      </section>
    </div>
  );
}
