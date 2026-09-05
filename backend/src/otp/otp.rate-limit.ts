import type { Request, RequestHandler } from 'express';

import { createIdentityAndIpRateLimit, type RateLimitStore } from '../security';
import { clientIp } from '../security/client-ip';
import { isFeatureEnabled } from '../features';
import type { AppConfig } from '../types/config';
import type { AppLogger } from '../utils/logger';

export function createOtpRateLimit(options: {
  store: RateLimitStore;
  config: AppConfig;
  logger?: AppLogger;
}): RequestHandler {
  return createIdentityAndIpRateLimit({
    store: options.store,
    windowMs: options.config.otp.rateLimitWindowMs,
    ipMax: options.config.otp.ipRateLimitMax,
    identityMax: options.config.otp.destinationRateLimitMax,
    ipPrefix: 'auth:otp:ip',
    identityPrefix: 'auth:otp:destination',
    identityKeyFn: otpDestinationKey,
    message: 'Too many OTP attempts. Try again later.',
    enabled: options.config.rateLimitEnabled && isFeatureEnabled(options.config, 'otp'),
    failClosed: options.config.rateLimits.failClosed,
    logger: options.logger,
  });
}

function otpDestinationKey(req: Request): string {
  const destination =
    req.body && typeof req.body === 'object' && 'destination' in req.body ? req.body.destination : undefined;
  if (typeof destination === 'string' && destination.trim() !== '') {
    return destination.trim().toLowerCase();
  }

  const email = req.body && typeof req.body === 'object' && 'email' in req.body ? req.body.email : undefined;
  if (typeof email === 'string' && email.trim() !== '') {
    return email.trim().toLowerCase();
  }

  return `ip:${clientIp(req)}`;
}
