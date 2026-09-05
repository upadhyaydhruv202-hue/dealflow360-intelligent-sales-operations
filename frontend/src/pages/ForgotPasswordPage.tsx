import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

import { confirmPasswordReset, requestPasswordReset } from '../services/auth';
import { getApiErrorMessage } from '../services/api';
import { Button, Input } from '../ui';
import { AuthScreen } from '../ui/auth/AuthScreen';

export function ForgotPasswordPage() {
  const [step, setStep] = useState<'request' | 'confirm' | 'done'>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function handleRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextEmail = email.trim();
    if (!nextEmail) {
      setError('Email is required.');
      return;
    }
    setPending(true);
    setError(undefined);
    try {
      await requestPasswordReset(nextEmail);
      setStep('confirm');
    } catch (caught) {
      setError(getApiErrorMessage(caught, 'Could not start password reset.'));
    } finally {
      setPending(false);
    }
  }

  async function handleConfirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!code.trim()) {
      setError('Enter the reset code from your email.');
      return;
    }
    if (password.length < 8) {
      setError('Password needs at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Password confirmation does not match.');
      return;
    }
    setPending(true);
    setError(undefined);
    try {
      await confirmPasswordReset({ email: email.trim(), code: code.trim(), password });
      setStep('done');
    } catch (caught) {
      setError(getApiErrorMessage(caught, 'Could not reset the password.'));
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthScreen title="Reset your password">
      {step === 'request' ? (
        <form className="space-y-4" onSubmit={handleRequest} noValidate>
          <p className="text-sm text-foreground-muted">
            Enter your work email. If an account exists, the API sends a reset code. The response never confirms whether
            the email is registered.
          </p>
          <Input
            label="Work email"
            type="email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          {error ? (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="submit" loading={pending} disabled={pending} className="w-full">
            Send reset code
          </Button>
        </form>
      ) : null}

      {step === 'confirm' ? (
        <form className="space-y-4" onSubmit={handleConfirm} noValidate>
          <p className="text-sm text-foreground-muted">
            Enter the code sent for {email} and choose a new password. Demo/mock OTP is delivered by the configured OTP
            provider — the UI never invents a code.
          </p>
          <Input
            label="Reset code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
          <Input
            label="New password"
            type={showPassword ? 'text' : 'password'}
            name="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <Input
            label="Confirm new password"
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
          {error ? (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="submit" loading={pending} disabled={pending} className="w-full">
            Update password
          </Button>
        </form>
      ) : null}

      {step === 'done' ? (
        <div className="space-y-4">
          <p className="text-sm text-foreground">Password updated. Sign in with the new password.</p>
          <Link className="inline-flex text-sm font-medium text-accent hover:underline" to="/login">
            Return to sign in
          </Link>
        </div>
      ) : null}

      {step !== 'done' ? (
        <p className="mt-6 text-sm text-foreground-muted">
          <Link className="font-medium text-accent hover:underline" to="/login">
            Back to sign in
          </Link>
        </p>
      ) : null}
    </AuthScreen>
  );
}
