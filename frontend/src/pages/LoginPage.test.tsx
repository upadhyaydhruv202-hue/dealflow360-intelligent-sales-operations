import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '../auth/AuthProvider';
import { DEMO_LOGIN_RATE_LIMIT_MESSAGE, INVALID_CREDENTIALS_MESSAGE } from '../auth/login-errors';
import { FeatureProvider } from '../features';
import { ThemeProvider } from '../ui';
import { LoginPage } from './LoginPage';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="pathname">{location.pathname}</div>;
}

describe('LoginPage', () => {
  it('replaces the login route after a successful sign-in', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({
          user: {
            id: 'user-1',
            email: 'demo.admin@example.com',
            displayName: 'Demo Admin',
            status: 'active',
            role: 'admin',
            roles: ['admin'],
            permissions: [],
          },
          tokens: {
            accessToken: 'access-1',
            refreshToken: 'refresh-1',
            tokenType: 'Bearer',
            expiresIn: 900,
          },
        }),
      ),
    );

    render(
      <MemoryRouter
        initialEntries={['/login']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <ThemeProvider>
          <AuthProvider>
            <LocationProbe />
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/dealflow" element={<p>Landed home</p>} />
            </Routes>
          </AuthProvider>
        </ThemeProvider>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'demo.admin@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'demo-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Landed home')).toBeInTheDocument();
    expect(screen.getByTestId('pathname')).toHaveTextContent('/dealflow');
  });

  it('sends a customer account to /account instead of the staff dashboard', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({
          user: {
            id: 'user-2',
            email: 'demo.user@example.com',
            displayName: 'Demo User',
            status: 'active',
            role: 'user',
            roles: ['user'],
            permissions: ['notifications.read'],
          },
          tokens: {
            accessToken: 'access-2',
            refreshToken: 'refresh-2',
            tokenType: 'Bearer',
            expiresIn: 900,
          },
        }),
      ),
    );

    render(
      <MemoryRouter
        initialEntries={['/login']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <ThemeProvider>
          <AuthProvider>
            <LocationProbe />
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/account" element={<p>Customer home</p>} />
              <Route path="/dealflow" element={<p>Staff home</p>} />
            </Routes>
          </AuthProvider>
        </ThemeProvider>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'demo.user@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'demo-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Customer home')).toBeInTheDocument();
    expect(screen.getByTestId('pathname')).toHaveTextContent('/account');
    expect(screen.queryByText('Staff home')).not.toBeInTheDocument();
  });

  it('offers signup and password reset from the login page', () => {
    render(
      <MemoryRouter
        initialEntries={['/login']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <ThemeProvider>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
            </Routes>
          </AuthProvider>
        </ThemeProvider>
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Create account / Sign up' })).toHaveAttribute('href', '/register');
    expect(screen.getByRole('link', { name: 'Forgot password' })).toHaveAttribute('href', '/forgot-password');
  });

  it('lists seeded demo roles when the API reports demo mode', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).includes('/api/v1/features')) {
          return jsonResponse({ demoMode: true, features: {} });
        }
        return jsonResponse({ demoMode: false, features: {} }, 401);
      }),
    );

    render(
      <MemoryRouter
        initialEntries={['/login']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <ThemeProvider>
          <AuthProvider>
            <FeatureProvider>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
              </Routes>
            </FeatureProvider>
          </AuthProvider>
        </ThemeProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Sales rep')).toBeInTheDocument();
    expect(screen.getByText('Sales manager')).toBeInTheDocument();
    expect(screen.getByText('Admin / director')).toBeInTheDocument();
    expect(screen.getByText('Finance')).toBeInTheDocument();
    expect(screen.getByText('Operations')).toBeInTheDocument();
    expect(screen.getByText('Customer')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /demo\.staff@example\.com/i }));
    expect(screen.getByLabelText('Email')).toHaveValue('demo.staff@example.com');
  });

  it('shows a demo-safe rate-limit message and generic invalid credentials', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).includes('/api/v1/features')) {
          return jsonResponse({ demoMode: true, features: {} });
        }
        if (String(input).includes('/auth/login')) {
          return jsonResponse(
            {
              success: false,
              error: { code: 'RATE_LIMIT', message: 'Too many login attempts. Try again later.', details: {} },
              requestId: 'req-1',
            },
            429,
          );
        }
        return jsonResponse({ demoMode: false, features: {} }, 401);
      }),
    );

    render(
      <MemoryRouter
        initialEntries={['/login']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <ThemeProvider>
          <AuthProvider>
            <FeatureProvider>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
              </Routes>
            </FeatureProvider>
          </AuthProvider>
        </ThemeProvider>
      </MemoryRouter>,
    );

    await screen.findByText('Sales rep');
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'demo.staff@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'demo-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(DEMO_LOGIN_RATE_LIMIT_MESSAGE);
  });

  it('does not reveal whether an email exists on invalid credentials', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).includes('/auth/login')) {
          return jsonResponse(
            {
              success: false,
              error: { code: 'UNAUTHORIZED', message: 'Invalid email or password', details: {} },
              requestId: 'req-2',
            },
            401,
          );
        }
        return jsonResponse({ demoMode: false, features: {} });
      }),
    );

    render(
      <MemoryRouter
        initialEntries={['/login']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <ThemeProvider>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
            </Routes>
          </AuthProvider>
        </ThemeProvider>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'unknown@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(INVALID_CREDENTIALS_MESSAGE);
  });
});

function jsonResponse(data: unknown, status = 200): Response {
  const envelope =
    data && typeof data === 'object' && 'success' in (data as object)
      ? data
      : { success: true, data, meta: {} };
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => envelope,
  } as Response;
}
