import { API_PATHS } from '@hackathon/api-contract';

import type { AuthSessionPayload, AuthUser } from '../types/api';
import { apiRequest } from './api';

export function login(email: string, password: string) {
  return apiRequest<AuthSessionPayload>(API_PATHS.auth.login, {
    method: 'POST',
    body: { email, password },
  });
}

export function register(input: { email: string; password: string; displayName: string }) {
  return apiRequest<AuthSessionPayload>(API_PATHS.auth.register, {
    method: 'POST',
    body: input,
  });
}

export function refreshSession(refreshToken?: string) {
  return apiRequest<AuthSessionPayload>(API_PATHS.auth.refresh, {
    method: 'POST',
    body: refreshToken ? { refreshToken } : {},
  });
}

export function logout(refreshToken?: string, accessToken?: string) {
  return apiRequest<{ revoked: boolean }>(API_PATHS.auth.logout, {
    method: 'POST',
    token: accessToken,
    body: refreshToken ? { refreshToken } : {},
  });
}

export function getMe(accessToken?: string) {
  return apiRequest<{ user: AuthUser }>(API_PATHS.auth.me, { token: accessToken });
}
