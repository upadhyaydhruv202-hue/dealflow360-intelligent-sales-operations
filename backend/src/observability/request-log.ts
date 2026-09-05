import type { NextFunction, Request, Response } from 'express';

import type { AppLogger } from '../utils/logger';
import { METRIC_NAMES } from './types';
import type { MetricsSink } from './types';

const SKIP_PATHS = new Set(['/health', '/ready']);

export function requestLoggingMiddleware(logger: AppLogger, metrics?: MetricsSink | null) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (SKIP_PATHS.has(req.path)) {
      next();
      return;
    }

    const started = Date.now();

    res.on('finish', () => {
      const durationMs = Date.now() - started;
      const payload = {
        module: 'http',
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs,
        requestId: req.requestId,
      };

      if (res.statusCode >= 500) {
        logger.error(payload, 'HTTP request');
      } else if (res.statusCode >= 400) {
        logger.warn(payload, 'HTTP request');
      } else {
        logger.info(payload, 'HTTP request');
      }

      const tags = { method: req.method, status: String(res.statusCode) };
      metrics?.increment(METRIC_NAMES.HTTP_REQUESTS, 1, tags);
      metrics?.timing(METRIC_NAMES.HTTP_LATENCY, durationMs, { method: req.method });
      if (res.statusCode >= 400) {
        metrics?.increment(METRIC_NAMES.HTTP_ERRORS, 1, tags);
      }
    });

    next();
  };
}
