import type { CorsOptions } from 'cors';

import type { AppConfig } from '../types/config';
import { expandLoopbackOrigins, isLoopbackOrigin } from './csrf';

export function createCorsOptions(config: AppConfig): CorsOptions {
  const allowlist = new Set(expandLoopbackOrigins(config.corsOrigins));

  return {
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      callback(null, allowlist.has(origin) || (!config.isProduction && isLoopbackOrigin(origin)));
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    exposedHeaders: [
      'X-Request-Id',
      'Retry-After',
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
    ],
    maxAge: 600,
    optionsSuccessStatus: 204,
  };
}
