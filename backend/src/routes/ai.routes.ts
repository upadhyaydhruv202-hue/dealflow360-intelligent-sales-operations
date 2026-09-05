import { Router, type RequestHandler } from 'express';

import type { AiController } from '../controllers/ai.controller';
import { PERMISSIONS } from '../rbac/catalog';
import { requirePermission } from '../rbac/middleware';

export function createAiRouter(options: {
  controller: AiController;
  authenticate: RequestHandler;
}): Router {
  const router = Router();
  const protect = [options.authenticate, requirePermission(PERMISSIONS.AI_USE)];

  router.get('/ai/health', options.authenticate, requirePermission(PERMISSIONS.AI_USE), options.controller.getHealth);
  router.post('/ai/generate', ...protect, options.controller.generateText);
  router.post('/ai/structured', ...protect, options.controller.generateStructured);
  router.post('/ai/summarize', ...protect, options.controller.summarize);
  router.post('/ai/classify', ...protect, options.controller.classify);
  router.post('/ai/extract', ...protect, options.controller.extract);
  router.post('/ai/analyze', ...protect, options.controller.analyze);
  router.post('/ai/recommend', ...protect, options.controller.recommend);
  router.post('/ai/draft', ...protect, options.controller.draft);
  router.post('/ai/embed', ...protect, options.controller.embed);

  return router;
}
