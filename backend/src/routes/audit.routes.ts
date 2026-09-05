import { Router, type RequestHandler } from 'express';

import type { AuditController } from '../controllers/audit.controller';
import { PERMISSIONS } from '../rbac/catalog';
import { requirePermission } from '../rbac/middleware';

export function createAuditRouter(options: {
  controller: AuditController;
  authenticate: RequestHandler;
}): Router {
  const router = Router();
  router.get(
    '/audit',
    options.authenticate,
    requirePermission(PERMISSIONS.AUDIT_READ),
    options.controller.list,
  );
  return router;
}
