import type { Request, RequestHandler } from 'express';

import { normalizeLoginEmail, shouldRelaxSeededDemoLoginRateLimit } from '../features';
import { createIdentityAndIpRateLimit, type RateLimitStore } from '../security';
import type { AppConfig } from '../types/config';
import type { AppLogger } from '../utils/logger';
import { clientIp } from '../security/client-ip';

export function createLoginRateLimit(options: {
  store: RateLimitStore;
  config: AppConfig;
  logger?: AppLogger;
}): RequestHandler {
  const limiter = createIdentityAndIpRateLimit({
    store: options.store,
    windowMs: options.config.auth.loginRateLimitWindowMs,
    ipMax: options.config.auth.loginIpRateLimitMax,
    identityMax: options.config.auth.loginRateLimitMax,
    ipPrefix: 'auth:login:ip',
    identityPrefix: 'auth:login:email',
    identityKeyFn: loginEmailKey,
    message: 'Too many login attempts. Try again later.',
    enabled: options.config.rateLimitEnabled,
    failClosed: options.config.rateLimits.failClosed,
    logger: options.logger,
  });

  return (req, res, next) => {
    if (shouldRelaxSeededDemoLoginRateLimit(options.config, loginEmailFromRequest(req))) {
      next();
      return;
    }

    limiter(req, res, next);
  };
}

function loginEmailFromRequest(req: Request): string | undefined {
  const email = req.body && typeof req.body === 'object' && 'email' in req.body ? req.body.email : undefined;
  return normalizeLoginEmail(email);
}

function loginEmailKey(req: Request): string {
  return loginEmailFromRequest(req) ?? `ip:${clientIp(req)}`;
}
