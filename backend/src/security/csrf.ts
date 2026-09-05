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

export function isTrustedOrigin(origin: string | undefined, config: AppConfig): boolean {
  if (!origin) {
    return false;
  }

  if (config.corsOrigins.includes(origin)) {
    return true;
  }

  try {
    if (new URL(config.app.url).origin === origin) {
      return true;
    }
    if (new URL(config.app.frontendUrl).origin === origin) {
      return true;
    }
  } catch {
    return false;
  }

  return false;
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
