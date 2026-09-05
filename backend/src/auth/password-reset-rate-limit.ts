import type { Request, RequestHandler } from 'express';

import { createIdentityAndIpRateLimit, type RateLimitStore } from '../security';
import { clientIp } from '../security/client-ip';
import type { AppConfig } from '../types/config';
import type { AppLogger } from '../utils/logger';

export function createPasswordResetRateLimit(options: {
  store: RateLimitStore;
  config: AppConfig;
  logger?: AppLogger;
}): RequestHandler {
  const policy = options.config.rateLimits.passwordReset;

  return createIdentityAndIpRateLimit({
    store: options.store,
    windowMs: policy.windowMs,
    ipMax: policy.ipMax,
    identityMax: policy.max,
    ipPrefix: 'auth:password-reset:ip',
    identityPrefix: 'auth:password-reset:email',
    identityKeyFn: passwordResetEmailKey,
    message: 'Too many password reset attempts. Try again later.',
    enabled: options.config.rateLimitEnabled,
    failClosed: options.config.rateLimits.failClosed,
    logger: options.logger,
  });
}

function passwordResetEmailKey(req: Request): string {
  const email = req.body && typeof req.body === 'object' && 'email' in req.body ? req.body.email : undefined;
  if (typeof email === 'string' && email.trim() !== '') {
    return email.trim().toLowerCase();
  }

  return `ip:${clientIp(req)}`;
}
