import type { NextFunction, Request, RequestHandler, Response } from 'express';

import type { AppConfig } from '../types/config';
import { requireFeature as assertFeatureEnabled } from './evaluate';
import type { FeatureName } from './registry';

export function requireFeature(config: AppConfig, name: FeatureName): RequestHandler {
  return (_req: Request, _res: Response, next: NextFunction): void => {
    try {
      assertFeatureEnabled(config, name);
      next();
    } catch (error) {
      next(error);
    }
  };
}
