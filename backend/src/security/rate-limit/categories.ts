import type { RequestHandler } from 'express';

import type { AppConfig } from '../../types/config';
import type { AppLogger } from '../../utils/logger';
import { clientIp, userOrIp } from '../client-ip';
import { RateLimiter } from './limiter';
import { rateLimit } from './middleware';
import type { RateLimitStore } from './types';

export const RATE_LIMIT_CATEGORIES = [
  'authentication',
  'otp',
  'ai',
  'fileUpload',
  'publicApi',
  'authenticatedApi',
  'adminApi',
] as const;

export type RateLimitCategory = (typeof RATE_LIMIT_CATEGORIES)[number];

export interface SecurityRateLimits {
  publicApi: RequestHandler;
  authentication: RequestHandler;
  authenticated: RequestHandler;
  admin: RequestHandler;
  ai: RequestHandler;
  fileUpload: RequestHandler;
}

export function createSecurityRateLimits(options: {
  store: RateLimitStore;
  config: AppConfig;
  logger?: AppLogger;
}): SecurityRateLimits {
  const enabled = options.config.rateLimitEnabled;
  const failClosed = options.config.rateLimits.failClosed;
  const policies = options.config.rateLimits;

  return {
    publicApi: categoryLimit({
      store: options.store,
      enabled,
      failClosed,
      logger: options.logger,
      max: policies.publicApi.max,
      windowMs: policies.publicApi.windowMs,
      prefix: 'rl:public',
      keyFn: clientIp,
      message: 'Too many requests. Try again later.',
    }),
    authentication: categoryLimit({
      store: options.store,
      enabled,
      failClosed,
      logger: options.logger,
      max: policies.authentication.max,
      windowMs: policies.authentication.windowMs,
      prefix: 'rl:auth',
      keyFn: clientIp,
      message: 'Too many authentication requests. Try again later.',
    }),
    authenticated: categoryLimit({
      store: options.store,
      enabled,
      failClosed,
      logger: options.logger,
      max: policies.authenticatedApi.max,
      windowMs: policies.authenticatedApi.windowMs,
      prefix: 'rl:authenticated',
      keyFn: userOrIp,
      message: 'Too many requests. Try again later.',
    }),
    admin: categoryLimit({
      store: options.store,
      enabled,
      failClosed,
      logger: options.logger,
      max: policies.adminApi.max,
      windowMs: policies.adminApi.windowMs,
      prefix: 'rl:admin',
      keyFn: userOrIp,
      message: 'Too many admin requests. Try again later.',
    }),
    ai: categoryLimit({
      store: options.store,
      enabled,
      failClosed,
      logger: options.logger,
      max: policies.ai.max,
      windowMs: policies.ai.windowMs,
      prefix: 'rl:ai',
      keyFn: userOrIp,
      message: 'Too many AI requests. Try again later.',
    }),
    fileUpload: categoryLimit({
      store: options.store,
      enabled,
      failClosed,
      logger: options.logger,
      max: policies.fileUpload.max,
      windowMs: policies.fileUpload.windowMs,
      prefix: 'rl:upload',
      keyFn: userOrIp,
      message: 'Too many file uploads. Try again later.',
    }),
  };
}

function categoryLimit(options: {
  store: RateLimitStore;
  enabled: boolean;
  failClosed: boolean;
  logger?: AppLogger;
  max: number;
  windowMs: number;
  prefix: string;
  keyFn: Parameters<typeof rateLimit>[0]['keyFn'];
  message: string;
}): RequestHandler {
  return rateLimit({
    limiter: new RateLimiter({
      store: options.store,
      windowMs: options.windowMs,
      max: options.max,
      prefix: options.prefix,
      enabled: options.enabled,
    }),
    keyFn: options.keyFn,
    logger: options.logger,
    failClosed: options.failClosed,
    message: options.message,
  });
}
