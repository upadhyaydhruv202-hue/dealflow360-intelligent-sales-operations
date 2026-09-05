import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '../auth/AuthProvider';
import { homePathForUser } from '../lib/rbac';
import { Button, Checkbox, Input } from '../ui';
import { AuthScreen } from '../ui/auth/AuthScreen';

function passwordIssues(password: string): string[] {
  const issues: string[] = [];
  if (password.length < 8) issues.push('at least 8 characters');
  if (!/[A-Za-z]/.test(password)) issues.push('a letter');
  return issues;
}

export function RegisterPage() {
  const { register, pending, error, isAuthenticated, ready, user } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [localError, setLocalError] = useState<string>();

  useEffect(() => {
    if (ready && isAuthenticated) {
      navigate(homePathForUser(user), { replace: true });
    }
  }, [isAuthenticated, navigate, ready, user]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = displayName.trim();
    const company = companyName.trim();
    const nextEmail = email.trim();
    if (!name || !company || !nextEmail || !password || !confirmPassword) {
      setLocalError('All fields are required.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
      setLocalError('Enter a valid work email.');
      return;
    }
    const issues = passwordIssues(password);
    if (issues.length) {
      setLocalError(`Password needs ${issues.join(', ')}.`);
      return;
    }
    if (password !== confirmPassword) {
      setLocalError('Password confirmation does not match.');
      return;
    }
    if (!acceptedTerms) {
      setLocalError('Accept the terms to create a customer account.');
      return;
    }
    setLocalError(undefined);
    await register({
      email: nextEmail,
      password,
      displayName: name,
      companyName: company,
    });
  }

  const message = localError ?? error;

  return (
    <AuthScreen title="Create a customer account">
      {isAuthenticated ? (
        <p className="text-sm text-foreground-muted">Redirecting…</p>
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit} noValidate>
          <p className="text-sm text-foreground-muted">
            Sign up creates a customer identity in PostgreSQL. Internal roles are assigned only by an administrator.
          </p>
          <Input
            label="Full name"
            name="displayName"
            autoComplete="name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
          <Input
            label="Company name"
            name="companyName"
            autoComplete="organization"
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
          />
          <Input
            label="Work email"
            type="email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <div className="space-y-2">
            <Input
              label="Password"
              type={showPassword ? 'text' : 'password'}
              name="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              hint="At least 8 characters. The server enforces the configured password policy."
            />
            <Input
              label="Confirm password"
              type={showPassword ? 'text' : 'password'}
              name="confirmPassword"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
            <button
              type="button"
              className="text-caption text-foreground-muted underline-offset-2 hover:text-foreground hover:underline"
              onClick={() => setShowPassword((current) => !current)}
            >
              {showPassword ? 'Hide passwords' : 'Show passwords'}
            </button>
          </div>
          <Checkbox
            label="I accept the customer portal terms and understand this account cannot access internal sales tools."
            checked={acceptedTerms}
            onChange={(event) => setAcceptedTerms(event.target.checked)}
          />
          {message ? (
            <p className="text-sm text-danger" role="alert">
              {message}
            </p>
          ) : null}
          <Button type="submit" loading={pending} disabled={pending} className="w-full">
            Create account
          </Button>
          <p className="text-sm text-foreground-muted">
            Already have an account?{' '}
            <Link className="font-medium text-accent hover:underline" to="/login">
              Sign in
            </Link>
          </p>
        </form>
      )}
    </AuthScreen>
  );
}
