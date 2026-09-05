import type { AppConfig } from '../types/config';

export interface SecureCookieOptions {
  httpOnly: true;
  secure: boolean;
  sameSite: 'strict' | 'lax' | 'none';
  path: string;
  domain?: string;
  maxAge?: number;
}

/**
 * Cookie flags for httpOnly session cookies (access + refresh).
 */
export function secureCookieOptions(
  config: Pick<AppConfig, 'isProduction'> & {
    auth?: { cookie?: { sameSite?: 'strict' | 'lax' | 'none' } };
  },
  overrides: Partial<SecureCookieOptions> = {},
): SecureCookieOptions {
  const sameSite = config.auth?.cookie?.sameSite ?? 'lax';
  return {
    httpOnly: true,
    secure: sameSite === 'none' ? true : config.isProduction,
    sameSite,
    path: '/',
    ...overrides,
  };
}
