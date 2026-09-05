import { Router, type RequestHandler } from 'express';

import { API_ROUTE_PATHS } from '../constants';
import type { ProjectPlanningController } from '../controllers/project-planning.controller';
import { PERMISSIONS } from '../rbac/catalog';
import { requirePermission } from '../rbac/middleware';

export function createProjectPlanningRouter(options: {
  controller: ProjectPlanningController;
  authenticate: RequestHandler;
  authenticateAnalyze: RequestHandler;
}): Router {
  const router = Router();
  const analyze = [options.authenticateAnalyze, requirePermission(PERMISSIONS.PROJECTS_PLAN)];
  const protect = [options.authenticate, requirePermission(PERMISSIONS.PROJECTS_PLAN)];

  router.post(API_ROUTE_PATHS.projectPlanning.analyze, ...analyze, options.controller.analyze);
  router.post(API_ROUTE_PATHS.projectPlanning.validate, ...protect, options.controller.validate);
  router.post(API_ROUTE_PATHS.projectPlanning.approve, ...protect, options.controller.approve);

  return router;
}
