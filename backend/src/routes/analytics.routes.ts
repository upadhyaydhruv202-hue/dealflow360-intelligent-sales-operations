import { Router, type RequestHandler } from 'express';

import { API_ROUTE_PATHS } from '../constants';
import type { AnalyticsController } from '../controllers/analytics.controller';
import { PERMISSIONS } from '../rbac/catalog';
import { requirePermission } from '../rbac/middleware';

export function createAnalyticsRouter(options: {
  controller: AnalyticsController;
  authenticate: RequestHandler;
}): Router {
  const router = Router();
  const read = [options.authenticate, requirePermission(PERMISSIONS.ANALYTICS_READ)];
  const write = [options.authenticate, requirePermission(PERMISSIONS.ANALYTICS_WRITE)];
  const exported = [options.authenticate, requirePermission(PERMISSIONS.ANALYTICS_EXPORT)];

  router.get(API_ROUTE_PATHS.analytics.kpis, ...read, options.controller.listKpis);
  router.get(API_ROUTE_PATHS.analytics.dashboards, ...read, options.controller.listDashboards);
  router.get(API_ROUTE_PATHS.analytics.dashboardById, ...read, options.controller.getDashboard);
  router.post(API_ROUTE_PATHS.analytics.dashboardById, ...read, options.controller.evaluateDashboard);
  router.post(API_ROUTE_PATHS.analytics.query, ...read, options.controller.query);
  router.post(API_ROUTE_PATHS.analytics.export, ...exported, options.controller.export);
  router.post(API_ROUTE_PATHS.analytics.facts, ...write, options.controller.ingest);

  return router;
}
