import { Router, type RequestHandler } from 'express';

import { API_ROUTE_PATHS } from '../constants';
import type { RagController } from '../controllers/rag.controller';
import { PERMISSIONS } from '../rbac/catalog';
import { requirePermission } from '../rbac/middleware';

export function createRagRouter(options: {
  controller: RagController;
  authenticate: RequestHandler;
}): Router {
  const router = Router();
  const protect = [options.authenticate, requirePermission(PERMISSIONS.RAG_USE)];

  router.post(API_ROUTE_PATHS.rag.index, ...protect, options.controller.index);
  router.get(API_ROUTE_PATHS.rag.documentById, ...protect, options.controller.getDocument);
  router.delete(API_ROUTE_PATHS.rag.documentById, ...protect, options.controller.deleteDocument);
  router.post(API_ROUTE_PATHS.rag.search, ...protect, options.controller.search);
  router.post(API_ROUTE_PATHS.rag.ask, ...protect, options.controller.ask);

  return router;
}
