import { Router, type RequestHandler } from 'express';

import { API_ROUTE_PATHS } from '../constants';
import type { CopilotController } from '../controllers/copilot.controller';
import { PERMISSIONS } from '../rbac/catalog';
import { requirePermission } from '../rbac/middleware';

export function createCopilotRouter(options: {
  controller: CopilotController;
  authenticate: RequestHandler;
}): Router {
  const router = Router();
  const protect = [options.authenticate, requirePermission(PERMISSIONS.COPILOT_USE)];

  router.get(API_ROUTE_PATHS.copilot.tools, ...protect, options.controller.listTools);
  router.post(API_ROUTE_PATHS.copilot.chat, ...protect, options.controller.chat);
  router.get(API_ROUTE_PATHS.copilot.conversations, ...protect, options.controller.listConversations);
  router.get(API_ROUTE_PATHS.copilot.conversationById, ...protect, options.controller.getConversation);
  router.post(API_ROUTE_PATHS.copilot.clearConversation, ...protect, options.controller.clearConversation);
  router.delete(API_ROUTE_PATHS.copilot.conversationById, ...protect, options.controller.deleteConversation);

  return router;
}
