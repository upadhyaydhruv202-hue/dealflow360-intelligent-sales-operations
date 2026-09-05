import { Router, type RequestHandler } from 'express';

import type { OdooController } from '../controllers/odoo.controller';
import { PERMISSIONS } from '../rbac/catalog';
import { requirePermission } from '../rbac/middleware';

export function createOdooRouter(options: {
  controller: OdooController;
  authenticate: RequestHandler;
}): Router {
  const router = Router();
  router.get(
    '/odoo/health',
    options.authenticate,
    requirePermission(PERMISSIONS.ODOO_READ),
    options.controller.getHealth,
  );
  return router;
}
