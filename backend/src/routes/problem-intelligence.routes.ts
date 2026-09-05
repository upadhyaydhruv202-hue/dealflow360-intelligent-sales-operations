import { Router, type RequestHandler } from 'express';

import { API_ROUTE_PATHS } from '../constants';
import type { ProblemIntelligenceController } from '../controllers/problem-intelligence.controller';
import { PERMISSIONS } from '../rbac/catalog';
import { requirePermission } from '../rbac/middleware';

export function createProblemIntelligenceRouter(options: {
  controller: ProblemIntelligenceController;
  authenticate: RequestHandler;
}): Router {
  const router = Router();
  const protect = [options.authenticate, requirePermission(PERMISSIONS.PROBLEM_ANALYZE)];

  router.post(API_ROUTE_PATHS.problemIntelligence.analyze, ...protect, options.controller.analyze);

  return router;
}
