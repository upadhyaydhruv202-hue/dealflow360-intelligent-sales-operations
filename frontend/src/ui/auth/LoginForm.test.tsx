import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LoginForm } from './LoginForm';

afterEach(() => {
  cleanup();
});

describe('LoginForm', () => {
  it('requires email and password', () => {
    const onSubmit = vi.fn();
    render(<LoginForm onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Email and password are required.');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits trimmed credentials', async () => {
    const onSubmit = vi.fn(async () => undefined);
    render(<LoginForm onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: '  demo.admin@example.com ' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'demo-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(onSubmit).toHaveBeenCalledWith({ email: 'demo.admin@example.com', password: 'demo-password' });
  });

  it('does not send a second request when Sign in is clicked twice', async () => {
    let resolveSubmit: (() => void) | undefined;
    const onSubmit = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSubmit = resolve;
        }),
    );
    render(<LoginForm onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'demo.staff@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'demo-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    resolveSubmit?.();
  });

  it('does not submit while the request is already loading', () => {
    const onSubmit = vi.fn();
    render(<LoginForm onSubmit={onSubmit} loading />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'demo.staff@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'demo-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
