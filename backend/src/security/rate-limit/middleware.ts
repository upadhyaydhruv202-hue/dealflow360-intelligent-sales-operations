import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { RateLimitError } from '../../errors';
import { asyncHandler } from '../../utils/async-handler';
import type { AppLogger } from '../../utils/logger';
import type { RateLimiter } from './limiter';

export interface RateLimitMiddlewareOptions {
  limiter: RateLimiter;
  keyFn: (req: Request) => string;
  logger?: AppLogger;
  message?: string;
  failClosed?: boolean;
}

export function rateLimit(options: RateLimitMiddlewareOptions): RequestHandler {
  return asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!options.limiter.enabled) {
      next();
      return;
    }

    const key = options.keyFn(req);

    try {
      const decision = await options.limiter.consume(key);
      const retryAfterSeconds = Math.max(1, Math.ceil((decision.resetAt - Date.now()) / 1000));

      res.setHeader('X-RateLimit-Limit', String(decision.limit));
      res.setHeader('X-RateLimit-Remaining', String(decision.remaining));
      res.setHeader('X-RateLimit-Reset', String(Math.ceil(decision.resetAt / 1000)));

      if (!decision.allowed) {
        res.setHeader('Retry-After', String(retryAfterSeconds));
        throw new RateLimitError(options.message ?? 'Too many requests', {
          retryAfterSeconds,
        });
      }

      next();
    } catch (error) {
      if (error instanceof RateLimitError) {
        throw error;
      }

      if (options.failClosed) {
        options.logger?.error({ err: error }, 'Rate limiter store failed; rejecting request');
        throw new RateLimitError(options.message ?? 'Too many requests', { retryAfterSeconds: 30 });
      }

      options.logger?.warn({ err: error }, 'Rate limiter store failed; allowing request');
      next();
    }
  });
}
