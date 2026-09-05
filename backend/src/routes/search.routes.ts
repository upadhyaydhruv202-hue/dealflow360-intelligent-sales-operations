import { Router, type RequestHandler } from 'express';

import { API_ROUTE_PATHS } from '../constants';
import type { SearchController } from '../controllers/search.controller';
import { PERMISSIONS } from '../rbac/catalog';
import { requirePermission } from '../rbac/middleware';

export function createSearchRouter(options: {
  controller: SearchController;
  authenticate: RequestHandler;
}): Router {
  const router = Router();
  const read = [options.authenticate, requirePermission(PERMISSIONS.SEARCH_USE)];
  const write = [options.authenticate, requirePermission(PERMISSIONS.SEARCH_WRITE)];

  router.get(API_ROUTE_PATHS.search.indexes, ...read, options.controller.listIndexes);
  router.post(API_ROUTE_PATHS.search.root, ...read, options.controller.search);
  router.post(API_ROUTE_PATHS.search.documents, ...write, options.controller.index);
  router.delete(API_ROUTE_PATHS.search.documentById, ...write, options.controller.delete);

  return router;
}
