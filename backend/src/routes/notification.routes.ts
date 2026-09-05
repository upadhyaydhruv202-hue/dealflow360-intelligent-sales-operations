import { Router, type RequestHandler } from 'express';

import { API_ROUTE_PATHS } from '../constants';
import type { NotificationController } from '../controllers/notification.controller';
import { PERMISSIONS } from '../rbac/catalog';
import { requirePermission } from '../rbac/middleware';

export function createNotificationRouter(options: {
  controller: NotificationController;
  authenticate: RequestHandler;
}): Router {
  const router = Router();
  const read = [options.authenticate, requirePermission(PERMISSIONS.NOTIFICATIONS_READ)];
  const write = [options.authenticate, requirePermission(PERMISSIONS.NOTIFICATIONS_WRITE)];

  router.get(API_ROUTE_PATHS.notifications.root, ...read, options.controller.list);
  router.get(API_ROUTE_PATHS.notifications.unreadCount, ...read, options.controller.unreadCount);
  router.get(API_ROUTE_PATHS.notifications.preferences, ...read, options.controller.getPreferences);
  router.put(API_ROUTE_PATHS.notifications.preferences, ...read, options.controller.updatePreferences);
  router.get(API_ROUTE_PATHS.notifications.deliveriesById, ...write, options.controller.getDelivery);
  router.post(API_ROUTE_PATHS.notifications.send, ...write, options.controller.send);
  router.post(API_ROUTE_PATHS.notifications.create, ...write, options.controller.create);
  router.post(API_ROUTE_PATHS.notifications.readAll, ...read, options.controller.markAllRead);
  router.post(API_ROUTE_PATHS.notifications.read, ...read, options.controller.markRead);

  return router;
}
