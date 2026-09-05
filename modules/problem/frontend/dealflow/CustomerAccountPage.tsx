import { Link, Navigate } from 'react-router-dom';

import { useAuth } from '@/auth/AuthProvider';
import { useOptionalFeatures } from '@/features';
import { Button, Card, CardDescription, CardTitle } from '@/ui';
import { useTheme } from '@/ui/theme/ThemeProvider';

const DEMO_PORTAL_PATH = '/portal/df-demo-portal-token-northwind-0001';

export function CustomerAccountPage() {
  const { user, logout, pending } = useAuth();
  const features = useOptionalFeatures();
  const { resolvedTheme, toggleTheme } = useTheme();
  const demoMode = features?.isDemo() === true;

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-surface text-foreground">
      <header className="flex items-center justify-between border-b border-edge px-6 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground-muted">DealFlow360</p>
          <h1 className="text-lg font-semibold">Customer account</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleTheme}
            aria-label={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {resolvedTheme === 'dark' ? 'Light' : 'Dark'}
          </Button>
          <Button variant="ghost" size="sm" loading={pending} onClick={() => void logout()}>
            Sign out
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-lg space-y-4 px-6 py-10">
        <Card>
          <CardTitle>This login cannot open the sales workspace</CardTitle>
          <CardDescription className="mt-2">
            {user?.displayName ?? 'This account'} is a customer-style user. Internal quotations, approvals, risk,
            fulfillment, and audit stay on staff, manager, and admin accounts. The API also rejects those requests.
          </CardDescription>
          <p className="mt-4 text-sm text-foreground">
            Customers review a quotation through a unique portal link copied from the quote workspace — not through this
            dashboard.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button onClick={() => void logout()}>Sign out and use a staff account</Button>
            {demoMode ? (
              <Link
                to={DEMO_PORTAL_PATH}
                className="inline-flex h-10 items-center rounded-lg border border-edge px-3.5 text-sm font-medium hover:bg-surface-muted"
              >
                Open seeded demo portal
              </Link>
            ) : null}
          </div>
        </Card>
        <p className="text-xs text-foreground-muted">
          Staff: demo.staff@example.com · Manager: demo.manager@example.com · Admin: demo.admin@example.com
        </p>
      </main>
    </div>
  );
}
