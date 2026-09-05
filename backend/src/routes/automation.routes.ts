import { Router, type RequestHandler } from 'express';

import { API_ROUTE_PATHS } from '../constants';
import type { AutomationController } from '../controllers/automation.controller';
import { PERMISSIONS } from '../rbac/catalog';
import { requirePermission } from '../rbac/middleware';

export function createAutomationRouter(options: {
  controller: AutomationController;
  authenticate: RequestHandler;
}): Router {
  const router = Router();
  const read = [options.authenticate, requirePermission(PERMISSIONS.AUTOMATIONS_READ)];
  const write = [options.authenticate, requirePermission(PERMISSIONS.AUTOMATIONS_WRITE)];
  const execute = [options.authenticate, requirePermission(PERMISSIONS.AUTOMATIONS_EXECUTE)];

  router.get(API_ROUTE_PATHS.automations.catalog, ...read, options.controller.catalog);
  router.get(API_ROUTE_PATHS.automations.rules, ...read, options.controller.listRules);
  router.post(API_ROUTE_PATHS.automations.rules, ...write, options.controller.createRule);
  router.get(API_ROUTE_PATHS.automations.ruleById, ...read, options.controller.getRule);
  router.patch(API_ROUTE_PATHS.automations.ruleById, ...write, options.controller.updateRule);
  router.post(API_ROUTE_PATHS.automations.validateRule, ...write, options.controller.validateRule);
  router.post(API_ROUTE_PATHS.automations.enableRule, ...write, options.controller.enableRule);
  router.post(API_ROUTE_PATHS.automations.disableRule, ...write, options.controller.disableRule);
  router.get(API_ROUTE_PATHS.automations.executions, ...read, options.controller.listExecutions);
  router.get(API_ROUTE_PATHS.automations.executionById, ...read, options.controller.getExecution);
  router.post(API_ROUTE_PATHS.automations.events, ...execute, options.controller.emitEvent);
  router.post(API_ROUTE_PATHS.automations.webhooks, ...execute, options.controller.receiveWebhook);

  return router;
}
