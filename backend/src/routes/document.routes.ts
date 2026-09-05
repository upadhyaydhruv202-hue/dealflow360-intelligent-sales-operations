import { Router, type RequestHandler } from 'express';

import type { DocumentController } from '../controllers/document.controller';
import { createDocumentUploadMiddleware } from '../middleware/document-upload';
import { PERMISSIONS } from '../rbac/catalog';
import { requirePermission } from '../rbac/middleware';

export function createDocumentRouter(options: {
  controller: DocumentController;
  authenticate: RequestHandler;
  uploadRateLimit?: RequestHandler;
  maxBytes?: number;
}): Router {
  const router = Router();
  const upload = createDocumentUploadMiddleware(options.maxBytes);
  const analyze = [
    options.authenticate,
    requirePermission(PERMISSIONS.DOCUMENTS_ANALYZE),
    ...(options.uploadRateLimit ? [options.uploadRateLimit] : []),
    upload,
    options.controller.analyze,
  ];

  router.post('/documents/analyze', ...analyze);
  router.get(
    '/documents/:id',
    options.authenticate,
    requirePermission(PERMISSIONS.DOCUMENTS_READ),
    options.controller.getById,
  );

  return router;
}
