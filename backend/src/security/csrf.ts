import type { RequestHandler } from 'express';

import { AuthorizationError } from '../errors';
import { ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME, readCookie } from '../auth/session-cookies';
import { tryExtractBearerToken } from '../auth/authenticate';
import type { AppConfig } from '../types/config';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function originFromReferer(referer: string | undefined): string | undefined {
  if (!referer) {
    return undefined;
  }

  try {
    return new URL(referer).origin;
  } catch {
    return undefined;
  }
}

export function expandLoopbackOrigins(origins: readonly string[]): string[] {
  const expanded = new Set(origins);
  for (const origin of origins) {
    try {
      const url = new URL(origin);
      if (url.hostname === 'localhost') {
        expanded.add(`${url.protocol}//127.0.0.1${url.port ? `:${url.port}` : ''}`);
      } else if (url.hostname === '127.0.0.1') {
        expanded.add(`${url.protocol}//localhost${url.port ? `:${url.port}` : ''}`);
      }
    } catch {
      continue;
    }
  }
  return [...expanded];
}

export function isLoopbackOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
  } catch {
    return false;
  }
}

export function isTrustedOrigin(origin: string | undefined, config: AppConfig): boolean {
  if (!origin) {
    return false;
  }

  if (!config.isProduction && isLoopbackOrigin(origin)) {
    return true;
  }

  const trusted = new Set(
    expandLoopbackOrigins([...config.corsOrigins, config.app.url, config.app.frontendUrl]),
  );
  if (trusted.has(origin)) {
    return true;
  }

  try {
    return trusted.has(new URL(origin).origin);
  } catch {
    return false;
  }
}

export function cookieCsrfProtection(config: AppConfig): RequestHandler {
  return (req, _res, next) => {
    if (SAFE_METHODS.has(req.method.toUpperCase())) {
      next();
      return;
    }

    if (tryExtractBearerToken(req.header('authorization'))) {
      next();
      return;
    }

    const hasSessionCookie =
      Boolean(readCookie(req, ACCESS_COOKIE_NAME)) || Boolean(readCookie(req, REFRESH_COOKIE_NAME));
    if (!hasSessionCookie) {
      next();
      return;
    }

    const origin = req.header('origin') ?? originFromReferer(req.header('referer'));
    if (!isTrustedOrigin(origin, config)) {
      next(new AuthorizationError('Cross-origin request is not allowed'));
      return;
    }

    next();
  };
}
