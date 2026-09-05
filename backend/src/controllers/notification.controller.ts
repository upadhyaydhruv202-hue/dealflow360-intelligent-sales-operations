import type { Request, Response } from 'express';

import { AuthenticationError, DatabaseError } from '../errors';
import { parseBody, parseParams, parseQuery } from '../schemas/parse';
import {
  createNotificationBodySchema,
  notificationIdParamsSchema,
  notificationListQuerySchema,
  sendNotificationBodySchema,
  updateNotificationPreferencesBodySchema,
} from '../notifications';
import type { NotificationService } from '../notifications';
import { asyncHandler } from '../utils/async-handler';
import { sendSuccess } from '../utils/response';

export class NotificationController {
  constructor(private readonly notifications: NotificationService | null) {}

  list = asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const query = parseQuery(notificationListQuerySchema, req.query);
    const result = await this.service().listForUser(user.id, query);
    return sendSuccess(res, { items: result.items }, 200, { ...result.meta });
  });

  unreadCount = asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const count = await this.service().unreadCount(user.id);
    return sendSuccess(res, { count });
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    requireUser(req);
    const body = parseBody(createNotificationBodySchema, req.body);
    const result = await this.service().notify(body);
    return sendSuccess(res, result, 'queued' in result && result.queued ? 202 : 201);
  });

  send = asyncHandler(async (req: Request, res: Response) => {
    requireUser(req);
    const body = parseBody(sendNotificationBodySchema, req.body);
    const result = await this.service().sendNotification(body);
    const status = result.queued ? 202 : result.skipped ? 200 : 201;
    return sendSuccess(res, result, status);
  });

  getPreferences = asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const result = await this.service().getPreferences(user.id);
    return sendSuccess(res, result);
  });

  updatePreferences = asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const body = parseBody(updateNotificationPreferencesBodySchema, req.body);
    const result = await this.service().updatePreferences(user.id, body);
    return sendSuccess(res, result);
  });

  getDelivery = asyncHandler(async (req: Request, res: Response) => {
    requireUser(req);
    const params = parseParams(notificationIdParamsSchema, req.params);
    const delivery = await this.service().getDelivery(params.id);
    return sendSuccess(res, delivery);
  });

  markRead = asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const params = parseParams(notificationIdParamsSchema, req.params);
    const notification = await this.service().markRead(params.id, user.id);
    return sendSuccess(res, notification);
  });

  markAllRead = asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const result = await this.service().markAllRead(user.id);
    return sendSuccess(res, result);
  });

  private service(): NotificationService {
    if (!this.notifications) {
      throw new DatabaseError('Notifications are not configured');
    }

    return this.notifications;
  }
}

function requireUser(req: Request) {
  if (!req.user) {
    throw new AuthenticationError();
  }

  return req.user;
}
