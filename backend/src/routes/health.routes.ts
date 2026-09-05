import { Router } from 'express';

import { OPERATIONAL_PATHS } from '../constants';
import type { HealthController } from '../controllers/health.controller';

export function createHealthRouter(controller: HealthController): Router {
  const router = Router();
  router.get(OPERATIONAL_PATHS.health, controller.getHealth);
  router.get(OPERATIONAL_PATHS.ready, controller.getReady);
  return router;
}
