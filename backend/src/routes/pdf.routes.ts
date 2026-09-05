import { Router, type RequestHandler } from 'express';

import { API_ROUTE_PATHS } from '../constants';
import type { PdfController } from '../controllers/pdf.controller';
import { PERMISSIONS } from '../rbac/catalog';
import { requirePermission } from '../rbac/middleware';

export function createPdfRouter(options: {
  controller: PdfController;
  authenticate: RequestHandler;
}): Router {
  const router = Router();
  router.post(
    API_ROUTE_PATHS.pdf.generate,
    options.authenticate,
    requirePermission(PERMISSIONS.REPORTS_GENERATE),
    options.controller.generate,
  );
  return router;
}
