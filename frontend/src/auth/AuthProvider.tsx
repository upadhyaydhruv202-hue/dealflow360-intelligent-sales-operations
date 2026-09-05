import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { login as loginRequest, logout as logoutRequest, refreshSession } from '../services/auth';
import { toLoginErrorMessage } from './login-errors';
import type { AuthUser } from '../types/api';

export const ACCESS_TOKEN_KEY = 'hsk.accessToken';
export const REFRESH_TOKEN_KEY = 'hsk.refreshToken';
export const AUTH_USER_KEY = 'hsk.authUser';

export interface AuthSession {
  user: AuthUser;
  accessToken: string;
  refreshToken?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  accessToken: string | undefined;
  isAuthenticated: boolean;
  pending: boolean;
  error: string | undefined;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function parseUser(value: unknown): AuthUser | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.id !== 'string' || typeof record.email !== 'string' || typeof record.displayName !== 'string') {
    return null;
  }
  return {
    id: record.id,
    email: record.email,
    displayName: record.displayName,
    status: typeof record.status === 'string' ? record.status : 'active',
    role: typeof record.role === 'string' ? record.role : 'user',
    roles: Array.isArray(record.roles) ? record.roles.filter((item): item is string => typeof item === 'string') : [],
    permissions: Array.isArray(record.permissions)
      ? record.permissions.filter((item): item is string => typeof item === 'string')
      : [],
  };
}

function clearLegacyTokens(): void {
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
}

function persistUser(user: AuthUser | null): void {
  clearLegacyTokens();
  if (!user) {
    window.localStorage.removeItem(AUTH_USER_KEY);
    return;
  }
  window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
}

function toSession(payload: { user: unknown; tokens: { accessToken: string; refreshToken?: string } }): AuthSession | null {
  const user = parseUser(payload.user);
  if (!user || !payload.tokens.accessToken) {
    return null;
  }
  return {
    user,
    accessToken: payload.tokens.accessToken,
    refreshToken: payload.tokens.refreshToken,
  };
}

export function AuthProvider({
  children,
  initialSession = null,
}: {
  children: ReactNode;
  initialSession?: AuthSession | null;
}) {
  const [session, setSession] = useState<AuthSession | null>(() => initialSession);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const loginInFlight = useRef(false);

  const applySession = useCallback((next: AuthSession | null) => {
    setSession(next);
    persistUser(next?.user ?? null);
  }, []);

  useEffect(() => {
    if (initialSession) {
      return;
    }
    clearLegacyTokens();
    let cancelled = false;
    void refreshSession()
      .then((payload) => {
        if (!cancelled) {
          applySession(toSession(payload));
        }
      })
      .catch(() => {
        if (!cancelled) {
          applySession(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [applySession, initialSession]);

  const login = useCallback(
    async (email: string, password: string) => {
      if (loginInFlight.current) {
        return false;
      }
      loginInFlight.current = true;
      setPending(true);
      setError(undefined);
      try {
        const payload = await loginRequest(email, password);
        const next = toSession(payload);
        if (!next) {
          setError('Sign in failed');
          return false;
        }
        applySession(next);
        return true;
      } catch (caught) {
        applySession(null);
        setError(toLoginErrorMessage(caught));
        return false;
      } finally {
        loginInFlight.current = false;
        setPending(false);
      }
    },
    [applySession],
  );

  const logout = useCallback(async () => {
    const current = session;
    setPending(true);
    try {
      await logoutRequest(current?.refreshToken, current?.accessToken).catch(() => undefined);
    } finally {
      applySession(null);
      setPending(false);
    }
  }, [applySession, session]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      accessToken: session?.accessToken || undefined,
      isAuthenticated: Boolean(session?.accessToken),
      pending,
      error,
      login,
      logout,
    }),
    [error, login, logout, pending, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return value;
}
