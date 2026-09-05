import type { CookieOptions, Request, RequestHandler, Response } from 'express';

import { API_PATHS, API_PREFIX } from '../constants';
import type { AuthSession } from './types';
import { parseDurationToSeconds } from '../lib/duration';
import { secureCookieOptions } from '../security/cookies';
import type { AppConfig } from '../types/config';

export const ACCESS_COOKIE_NAME = 'hsk_access';
export const REFRESH_COOKIE_NAME = 'hsk_refresh';

export function parseCookieHeader(header: string | undefined): Record<string, string> {
  if (!header) {
    return {};
  }

  const cookies: Record<string, string> = {};
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator <= 0) {
      continue;
    }

    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (!name) {
      continue;
    }

    try {
      cookies[name] = decodeURIComponent(value);
    } catch {
      cookies[name] = value;
    }
  }

  return cookies;
}

export function parseCookiesMiddleware(): RequestHandler {
  return (req, _res, next) => {
    req.cookies = parseCookieHeader(req.header('cookie'));
    next();
  };
}

export function readCookie(req: Request, name: string): string | undefined {
  const value = req.cookies?.[name] ?? parseCookieHeader(req.header('cookie'))[name];
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function readAccessCookie(req: Request): string | undefined {
  return readCookie(req, ACCESS_COOKIE_NAME);
}

export function readRefreshCookie(req: Request): string | undefined {
  return readCookie(req, REFRESH_COOKIE_NAME);
}

export function applySessionCookies(res: Response, session: AuthSession, config: AppConfig): void {
  if (!config.auth.cookie.enabled) {
    return;
  }

  const accessMaxAge = parseDurationToSeconds(config.jwt.accessExpiresIn);
  const refreshMaxAge = parseDurationToSeconds(config.jwt.refreshExpiresIn);
  res.cookie(ACCESS_COOKIE_NAME, session.tokens.accessToken, cookieOptions(config, {
    path: API_PREFIX,
    maxAge: accessMaxAge * 1000,
  }));
  res.cookie(REFRESH_COOKIE_NAME, session.tokens.refreshToken, cookieOptions(config, {
    path: API_PATHS.auth.root,
    maxAge: refreshMaxAge * 1000,
  }));
}

export function clearSessionCookies(res: Response, config: AppConfig): void {
  const base = cookieOptions(config);
  res.clearCookie(ACCESS_COOKIE_NAME, { ...base, path: API_PREFIX, maxAge: 0 });
  res.clearCookie(REFRESH_COOKIE_NAME, { ...base, path: API_PATHS.auth.root, maxAge: 0 });
}

function cookieOptions(config: AppConfig, overrides: Partial<CookieOptions> = {}): CookieOptions {
  const secure = config.auth.cookie.sameSite === 'none' ? true : config.isProduction;
  return {
    ...secureCookieOptions(config, {
      sameSite: config.auth.cookie.sameSite,
      secure,
    }),
    ...overrides,
  };
}
