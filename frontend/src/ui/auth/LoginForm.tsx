import { useEffect, useState, type FormEvent } from 'react';

import { Button } from '../primitives/Button';
import { Input } from '../primitives/Input';

export interface LoginFormValues {
  email: string;
  password: string;
}

export function LoginForm({
  onSubmit,
  loading = false,
  error,
  submitLabel = 'Sign in',
  hint,
  emailValue,
  onEmailChange,
}: {
  onSubmit: (values: LoginFormValues) => unknown | Promise<unknown>;
  loading?: boolean;
  error?: string;
  submitLabel?: string;
  hint?: string;
  emailValue?: string;
  onEmailChange?: (email: string) => void;
}) {
  const [email, setEmail] = useState(emailValue ?? '');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (emailValue !== undefined) {
      setEmail(emailValue);
    }
  }, [emailValue]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || submitting) {
      return;
    }
    const nextEmail = email.trim();
    if (!nextEmail || !password) {
      setLocalError('Email and password are required.');
      return;
    }
    setLocalError(undefined);
    setSubmitting(true);
    try {
      await onSubmit({ email: nextEmail, password });
    } finally {
      setSubmitting(false);
    }
  }

  const message = localError ?? error;
  const busy = loading || submitting;

  return (
    <form className="space-y-4" onSubmit={handleSubmit} noValidate>
      {hint ? <p className="text-sm text-foreground-muted">{hint}</p> : null}
      <Input
        label="Email"
        type="email"
        name="email"
        autoComplete="username"
        value={email}
        onChange={(event) => {
          setEmail(event.target.value);
          onEmailChange?.(event.target.value);
        }}
      />
      <Input
        label="Password"
        type="password"
        name="password"
        autoComplete="current-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      {message ? (
        <p className="text-sm text-danger" role="alert">
          {message}
        </p>
      ) : null}
      <Button type="submit" loading={busy} disabled={busy} className="w-full">
        {submitLabel}
      </Button>
    </form>
  );
}
