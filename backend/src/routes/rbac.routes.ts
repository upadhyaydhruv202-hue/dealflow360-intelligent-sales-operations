import { Router, type RequestHandler } from 'express';

import type { RbacController } from '../controllers/rbac.controller';
import { PERMISSIONS } from '../rbac/catalog';
import { requirePermission } from '../rbac/middleware';

export function createRbacRouter(options: {
  controller: RbacController;
  authenticate: RequestHandler;
}): Router {
  const router = Router();
  const readCatalog = [options.authenticate, requirePermission(PERMISSIONS.ROLES_READ)];
  const writeCatalog = [options.authenticate, requirePermission(PERMISSIONS.ROLES_WRITE)];

  router.get('/roles', ...readCatalog, options.controller.listRoles);
  router.post('/roles', ...writeCatalog, options.controller.createRole);
  router.get('/permissions', ...readCatalog, options.controller.listPermissions);
  router.post('/permissions', ...writeCatalog, options.controller.createPermission);
  router.post(
    '/roles/:roleName/permissions',
    ...writeCatalog,
    options.controller.assignPermission,
  );
  router.post('/users/:userId/roles', ...writeCatalog, options.controller.assignRole);

  return router;
}
