import { Router, type RequestHandler } from 'express';

import { API_ROUTE_PATHS } from '../constants';
import type { IntentsController } from '../controllers/intents.controller';
import { PERMISSIONS } from '../rbac/catalog';
import { requirePermission } from '../rbac/middleware';

export function createIntentsRouter(options: {
  controller: IntentsController;
  authenticate: RequestHandler;
}): Router {
  const router = Router();
  const protect = [options.authenticate, requirePermission(PERMISSIONS.INTENTS_USE)];

  router.get(API_ROUTE_PATHS.intents.root, ...protect, options.controller.list);
  router.post(API_ROUTE_PATHS.intents.execute, ...protect, options.controller.execute);

  return router;
}
