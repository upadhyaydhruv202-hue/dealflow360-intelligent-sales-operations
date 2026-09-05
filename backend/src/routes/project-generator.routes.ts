import { Router, type RequestHandler } from 'express';

import { API_ROUTE_PATHS } from '../constants';
import type { ProjectGeneratorController } from '../controllers/project-generator.controller';
import { PERMISSIONS } from '../rbac/catalog';
import { requirePermission } from '../rbac/middleware';

export function createProjectGeneratorRouter(options: {
  controller: ProjectGeneratorController;
  authenticate: RequestHandler;
}): Router {
  const router = Router();
  const protect = [options.authenticate, requirePermission(PERMISSIONS.PROJECTS_GENERATE)];

  router.post(API_ROUTE_PATHS.projectGenerator.preview, ...protect, options.controller.preview);
  router.post(API_ROUTE_PATHS.projectGenerator.generate, ...protect, options.controller.generate);

  return router;
}
