import { Router, type RequestHandler } from 'express';

import { API_ROUTE_PATHS } from '../constants';
import type { FeaturesController } from '../controllers/features.controller';

export function createFeaturesRouter(options: {
  controller: FeaturesController;
  publicRateLimit: RequestHandler;
}): Router {
  const router = Router();
  router.get(API_ROUTE_PATHS.features, options.publicRateLimit, options.controller.getFeatures);
  return router;
}
