import type { Request, RequestHandler } from 'express';

import { RateLimiter } from './limiter';
import { rateLimit } from './middleware';
import type { RateLimitStore } from './types';
import { clientIp } from '../client-ip';
import type { AppLogger } from '../../utils/logger';

export function createIdentityAndIpRateLimit(options: {
  store: RateLimitStore;
  windowMs: number;
  ipMax: number;
  identityMax: number;
  ipPrefix: string;
  identityPrefix: string;
  identityKeyFn: (req: Request) => string;
  message: string;
  enabled: boolean;
  failClosed?: boolean;
  logger?: AppLogger;
}): RequestHandler {
  const ipMiddleware = rateLimit({
    limiter: new RateLimiter({
      store: options.store,
      windowMs: options.windowMs,
      max: options.ipMax,
      prefix: options.ipPrefix,
      enabled: options.enabled,
    }),
    keyFn: clientIp,
    logger: options.logger,
    failClosed: options.failClosed,
    message: options.message,
  });

  const identityMiddleware = rateLimit({
    limiter: new RateLimiter({
      store: options.store,
      windowMs: options.windowMs,
      max: options.identityMax,
      prefix: options.identityPrefix,
      enabled: options.enabled,
    }),
    keyFn: options.identityKeyFn,
    logger: options.logger,
    failClosed: options.failClosed,
    message: options.message,
  });

  return (req, res, next) => {
    ipMiddleware(req, res, (error?: unknown) => {
      if (error) {
        next(error);
        return;
      }
      identityMiddleware(req, res, next);
    });
  };
}
