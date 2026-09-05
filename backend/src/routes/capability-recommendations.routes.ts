import { Router, type RequestHandler } from 'express';

import { API_ROUTE_PATHS } from '../constants';
import type { CapabilityRecommendationController } from '../controllers/capability-recommendations.controller';
import { PERMISSIONS } from '../rbac/catalog';
import { requirePermission } from '../rbac/middleware';

export function createCapabilityRecommendationRouter(options: {
  controller: CapabilityRecommendationController;
  authenticate: RequestHandler;
}): Router {
  const router = Router();
  const protect = [options.authenticate, requirePermission(PERMISSIONS.CAPABILITIES_RECOMMEND)];

  router.post(API_ROUTE_PATHS.capabilityRecommendations.recommend, ...protect, options.controller.recommend);

  return router;
}
