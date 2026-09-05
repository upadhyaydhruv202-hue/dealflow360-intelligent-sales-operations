import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider, useAuth } from './AuthProvider';
import { INVALID_CREDENTIALS_MESSAGE } from './login-errors';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

function Probe() {
  const { isAuthenticated, user, login, logout, error } = useAuth();
  return (
    <div>
      <p>{isAuthenticated ? `hello ${user?.displayName}` : 'signed out'}</p>
      {error ? <p>{error}</p> : null}
      <button type="button" onClick={() => void login('demo.admin@example.com', 'demo-password')}>
        Login
      </button>
      <button type="button" onClick={() => void logout()}>
        Logout
      </button>
    </div>
  );
}

describe('AuthProvider', () => {
  it('stores a session on login and clears it on logout', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/auth/login')) {
        return jsonResponse({
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
        });
      }
      return jsonResponse({ revoked: true });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Login' }));
    expect(await screen.findByText('hello Demo Admin')).toBeInTheDocument();
    expect(localStorage.getItem('hsk.accessToken')).toBeNull();
    expect(localStorage.getItem('hsk.refreshToken')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Logout' }));
    await waitFor(() => {
      expect(screen.getByText('signed out')).toBeInTheDocument();
    });
    expect(localStorage.getItem('hsk.accessToken')).toBeNull();
  });

  it('surfaces login errors without storing tokens', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse(
          {
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Invalid email or password', details: {} },
            requestId: 'req-1',
          },
          401,
        ),
      ),
    );

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Login' }));
    expect(await screen.findByText(INVALID_CREDENTIALS_MESSAGE)).toBeInTheDocument();
    expect(localStorage.getItem('hsk.accessToken')).toBeNull();
  });

  it('ignores a second login while the first request is in flight', async () => {
    let resolveLogin: ((value: Response) => void) | undefined;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (!String(input).includes('/auth/login')) {
        return jsonResponse(
          {
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Authentication required', details: {} },
            requestId: 'req-refresh',
          },
          401,
        );
      }
      return new Promise<Response>((resolve) => {
        resolveLogin = resolve;
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Login' }));
    fireEvent.click(screen.getByRole('button', { name: 'Login' }));
    await waitFor(() => {
      expect(fetchMock.mock.calls.filter((call) => String(call[0]).includes('/auth/login'))).toHaveLength(1);
    });
    resolveLogin?.(
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
    );
    expect(await screen.findByText('hello Demo Admin')).toBeInTheDocument();
  });

  it('persists only known user fields from the login payload', async () => {
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
            roles: ['admin', 2],
            permissions: ['users.read', { extra: true }],
            inject: '<script>alert(1)</script>',
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
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Login' }));
    expect(await screen.findByText('hello Demo Admin')).toBeInTheDocument();

    const stored = JSON.parse(localStorage.getItem('hsk.authUser') ?? '{}') as Record<string, unknown>;
    expect(stored).toEqual({
      id: 'user-1',
      email: 'demo.admin@example.com',
      displayName: 'Demo Admin',
      status: 'active',
      role: 'admin',
      roles: ['admin'],
      permissions: ['users.read'],
    });
  });

  it('ignores and clears a malformed stored user', async () => {
    localStorage.setItem('hsk.accessToken', 'access-stale');
    localStorage.setItem('hsk.refreshToken', 'refresh-stale');
    localStorage.setItem('hsk.authUser', JSON.stringify({ inject: true }));

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    expect(screen.getByText('signed out')).toBeInTheDocument();
    await waitFor(() => {
      expect(localStorage.getItem('hsk.accessToken')).toBeNull();
    });
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
