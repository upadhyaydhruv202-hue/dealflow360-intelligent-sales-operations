import { Router, type RequestHandler } from 'express';

import { API_ROUTE_PATHS } from '../constants';
import type { AnomalyController } from '../controllers/anomaly.controller';
import { PERMISSIONS } from '../rbac/catalog';
import { requirePermission } from '../rbac/middleware';

export function createAnomalyRouter(options: {
  controller: AnomalyController;
  authenticate: RequestHandler;
}): Router {
  const router = Router();
  const protect = [options.authenticate, requirePermission(PERMISSIONS.ANOMALY_USE)];

  router.post(API_ROUTE_PATHS.anomalies.evaluate, ...protect, options.controller.evaluate);
  router.get(API_ROUTE_PATHS.anomalies.root, ...protect, options.controller.list);
  router.get(API_ROUTE_PATHS.anomalies.byId, ...protect, options.controller.getFinding);

  return router;
}
