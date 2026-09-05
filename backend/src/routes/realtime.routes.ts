import { Router, type RequestHandler } from 'express';

import { API_ROUTE_PATHS } from '../constants';
import type { RealtimeController } from '../controllers/realtime.controller';

export function createRealtimeRouter(options: {
  controller: RealtimeController;
  authenticate: RequestHandler;
}): Router {
  const router = Router();
  router.get(API_ROUTE_PATHS.realtime.channels, options.authenticate, options.controller.listChannels);
  router.get(API_ROUTE_PATHS.realtime.events, options.authenticate, options.controller.events);
  return router;
}
