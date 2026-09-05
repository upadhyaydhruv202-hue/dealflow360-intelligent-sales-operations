import { Router, type RequestHandler } from 'express';

import { API_ROUTE_PATHS } from '../constants';
import type { StorageController } from '../controllers/storage.controller';
import { createFileUploadMiddleware } from '../middleware/file-upload';
import { PERMISSIONS } from '../rbac/catalog';
import { requirePermission } from '../rbac/middleware';

export function createStorageRouter(options: {
  controller: StorageController;
  authenticate: RequestHandler;
  authenticateOptional?: RequestHandler;
  publicRateLimit?: RequestHandler;
  uploadRateLimit?: RequestHandler;
  maxBytes?: number;
}): Router {
  const router = Router();
  const upload = createFileUploadMiddleware(options.maxBytes);

  router.get(
    API_ROUTE_PATHS.storage.download,
    ...(options.publicRateLimit ? [options.publicRateLimit] : []),
    ...(options.authenticateOptional ? [options.authenticateOptional] : []),
    options.controller.download,
  );
  router.post(
    API_ROUTE_PATHS.files.root,
    options.authenticate,
    requirePermission(PERMISSIONS.FILES_WRITE),
    ...(options.uploadRateLimit ? [options.uploadRateLimit] : []),
    upload,
    options.controller.upload,
  );
  router.get(
    API_ROUTE_PATHS.files.byId,
    options.authenticate,
    requirePermission(PERMISSIONS.FILES_READ),
    options.controller.getById,
  );
  router.get(
    API_ROUTE_PATHS.files.content,
    options.authenticate,
    requirePermission(PERMISSIONS.FILES_READ),
    options.controller.downloadContent,
  );
  router.post(
    API_ROUTE_PATHS.files.signedUrl,
    options.authenticate,
    requirePermission(PERMISSIONS.FILES_READ),
    options.controller.signedUrl,
  );
  router.delete(
    API_ROUTE_PATHS.files.byId,
    options.authenticate,
    requirePermission(PERMISSIONS.FILES_WRITE),
    options.controller.remove,
  );

  return router;
}
