import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '../auth/AuthProvider';
import { remapLoginError } from '../auth/login-errors';
import { useOptionalFeatures } from '../features';
import { homePathForUser } from '../lib/rbac';
import { Badge } from '../ui';
import { AuthScreen } from '../ui/auth/AuthScreen';
import { LoginForm } from '../ui/auth/LoginForm';

const DEMO_ACCOUNTS = [
  { role: 'Sales rep', email: 'demo.staff@example.com', note: 'Create quotes, submit, fulfill, bill' },
  { role: 'Sales manager', email: 'demo.manager@example.com', note: 'First approval step' },
  { role: 'Admin / director', email: 'demo.admin@example.com', note: 'Remaining approvals and catalog' },
  { role: 'Finance', email: 'demo.finance@example.com', note: 'Billing and finance approvals' },
  { role: 'Operations', email: 'demo.operations@example.com', note: 'Inventory, warehouses, and fulfillment' },
  { role: 'Customer', email: 'demo.user@example.com', note: 'Customer account page and portal — not the staff dashboard' },
] as const;

export function LoginPage() {
  const { login, pending, error, isAuthenticated, ready, user } = useAuth();
  const features = useOptionalFeatures();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const demoMode = features?.isDemo() === true;

  useEffect(() => {
    if (ready && isAuthenticated) {
      navigate(homePathForUser(user), { replace: true });
    }
  }, [isAuthenticated, navigate, ready, user]);

  const displayError = remapLoginError(error, demoMode);

  return (
    <AuthScreen title="Sales operations sign-in">
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
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <Link className="font-medium text-accent hover:underline" to="/register">
              Create account / Sign up
            </Link>
            <Link className="text-foreground-muted hover:text-foreground hover:underline" to="/forgot-password">
              Forgot password
            </Link>
          </div>
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
    </AuthScreen>
  );
}
