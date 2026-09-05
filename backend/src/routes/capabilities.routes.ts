import { Router, type RequestHandler } from 'express';

import { API_ROUTE_PATHS } from '../constants';
import type { CapabilitiesController } from '../controllers/capabilities.controller';

export function createCapabilitiesRouter(options: {
  controller: CapabilitiesController;
  publicRateLimit: RequestHandler;
}): Router {
  const router = Router();
  router.get(API_ROUTE_PATHS.capabilities, options.publicRateLimit, options.controller.listCapabilities);
  return router;
}
