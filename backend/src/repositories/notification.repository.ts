import { Prisma } from '@prisma/client';

import { NotFoundError } from '../errors';
import { mapPrismaError } from '../lib/prisma-error';
import { parsePagination, parseSort, toPaginatedResult, toPrismaOrderBy, type PaginationInput, type SortInput } from './query';
import type { DbClient } from './types';
import type {
  NotificationCategory,
  NotificationChannel,
  NotificationDeliveryRecord,
  NotificationDeliveryStatus,
  NotificationPriority,
  NotificationRecipient,
} from '../notifications/notification.types';

export const NOTIFICATION_SORT_FIELDS = ['createdAt', 'updatedAt'] as const;

export interface CreateNotificationInput {
  userId: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  body: string;
  category?: NotificationCategory;
  priority?: NotificationPriority;
  metadata?: Record<string, unknown> | null;
  deliveryId?: string | null;
  readAt?: Date | null;
}

export interface NotificationListInput extends PaginationInput, SortInput {
  userId: string;
  unreadOnly?: boolean;
}

export interface CreateDeliveryInput {
  channel: NotificationChannel;
  status: NotificationDeliveryStatus;
  priority: NotificationPriority;
  category: NotificationCategory;
  template: string;
  recipient: NotificationRecipient;
  data: Record<string, unknown>;
  metadata?: Record<string, unknown> | null;
  userId?: string | null;
  idempotencyKey?: string | null;
  attempt?: number;
  maxAttempts?: number;
  errorMessage?: string | null;
}

export interface UpdateDeliveryInput {
  status?: NotificationDeliveryStatus;
  attempt?: number;
  errorMessage?: string | null;
  provider?: string | null;
  providerMessageId?: string | null;
  sentAt?: Date | null;
}

export interface UpsertPreferenceInput {
  userId: string;
  category: NotificationCategory;
  channel: NotificationChannel;
  enabled: boolean;
}

export class NotificationRepository {
  constructor(private readonly db: DbClient) {}

  async create(input: CreateNotificationInput) {
    try {
      return await this.db.notification.create({
        data: {
          userId: input.userId,
          type: input.type,
          title: input.title.trim(),
          body: input.body.trim(),
          category: input.category ?? 'system',
          priority: input.priority ?? 'normal',
          metadata: toJson(input.metadata),
          deliveryId: input.deliveryId ?? null,
          readAt: input.readAt ?? null,
        },
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async listForUser(input: NotificationListInput) {
    const pagination = parsePagination(input);
    const sort = parseSort(input, NOTIFICATION_SORT_FIELDS, 'createdAt', 'desc');

    try {
      const where = {
        userId: input.userId,
        ...(input.unreadOnly ? { readAt: null } : {}),
      };
      const [items, totalItems] = await Promise.all([
        this.db.notification.findMany({
          where,
          orderBy: toPrismaOrderBy(sort),
          skip: pagination.skip,
          take: pagination.take,
        }),
        this.db.notification.count({ where }),
      ]);

      return toPaginatedResult(items, pagination, totalItems);
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async findByIdForUser(id: string, userId: string) {
    try {
      const notification = await this.db.notification.findFirst({ where: { id, userId } });
      if (!notification) {
        throw new NotFoundError('Notification not found');
      }
      return notification;
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async markRead(id: string, userId: string) {
    const notification = await this.findByIdForUser(id, userId);
    if (notification.readAt) {
      return notification;
    }

    try {
      return await this.db.notification.update({
        where: { id },
        data: { readAt: new Date() },
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async markAllRead(userId: string): Promise<{ count: number }> {
    try {
      const result = await this.db.notification.updateMany({
        where: { userId, readAt: null },
        data: { readAt: new Date() },
      });
      return { count: result.count };
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async unreadCount(userId: string): Promise<number> {
    try {
      return await this.db.notification.count({ where: { userId, readAt: null } });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async createDelivery(input: CreateDeliveryInput): Promise<NotificationDeliveryRecord> {
    try {
      const row = await this.db.notificationDelivery.create({
        data: {
          channel: input.channel,
          status: input.status,
          priority: input.priority,
          category: input.category,
          template: input.template,
          recipient: toJsonRequired(input.recipient as Record<string, unknown>),
          data: toJsonRequired(input.data),
          metadata: toJson(input.metadata),
          userId: input.userId ?? null,
          idempotencyKey: input.idempotencyKey ?? null,
          attempt: input.attempt ?? 0,
          maxAttempts: input.maxAttempts ?? 3,
          errorMessage: input.errorMessage ?? null,
        },
      });
      return toDeliveryRecord(row);
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async updateDelivery(id: string, input: UpdateDeliveryInput): Promise<NotificationDeliveryRecord> {
    try {
      const row = await this.db.notificationDelivery.update({
        where: { id },
        data: {
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.attempt !== undefined ? { attempt: input.attempt } : {}),
          ...(input.errorMessage !== undefined ? { errorMessage: input.errorMessage } : {}),
          ...(input.provider !== undefined ? { provider: input.provider } : {}),
          ...(input.providerMessageId !== undefined ? { providerMessageId: input.providerMessageId } : {}),
          ...(input.sentAt !== undefined ? { sentAt: input.sentAt } : {}),
        },
      });
      return toDeliveryRecord(row);
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async findDeliveryById(id: string): Promise<NotificationDeliveryRecord | null> {
    try {
      const row = await this.db.notificationDelivery.findUnique({ where: { id } });
      return row ? toDeliveryRecord(row) : null;
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async findDeliveryByIdOrThrow(id: string): Promise<NotificationDeliveryRecord> {
    const delivery = await this.findDeliveryById(id);
    if (!delivery) {
      throw new NotFoundError('Notification delivery not found');
    }
    return delivery;
  }

  async findDeliveryByIdempotencyKey(key: string): Promise<NotificationDeliveryRecord | null> {
    try {
      const row = await this.db.notificationDelivery.findUnique({ where: { idempotencyKey: key } });
      return row ? toDeliveryRecord(row) : null;
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async listPreferences(userId: string) {
    try {
      return await this.db.notificationPreference.findMany({
        where: { userId },
        orderBy: [{ category: 'asc' }, { channel: 'asc' }],
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async findPreference(userId: string, category: NotificationCategory, channel: NotificationChannel) {
    try {
      return await this.db.notificationPreference.findUnique({
        where: { userId_category_channel: { userId, category, channel } },
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async upsertPreference(input: UpsertPreferenceInput) {
    try {
      return await this.db.notificationPreference.upsert({
        where: {
          userId_category_channel: {
            userId: input.userId,
            category: input.category,
            channel: input.channel,
          },
        },
        create: {
          userId: input.userId,
          category: input.category,
          channel: input.channel,
          enabled: input.enabled,
        },
        update: { enabled: input.enabled },
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }
}

function toJson(value: Record<string, unknown> | null | undefined): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return Prisma.JsonNull;
  }
  return value as Prisma.InputJsonValue;
}

function toJsonRequired(value: Record<string, unknown>): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function toDeliveryRecord(row: {
  id: string;
  channel: NotificationChannel;
  status: NotificationDeliveryStatus;
  priority: NotificationPriority;
  category: NotificationCategory;
  template: string;
  recipient: Prisma.JsonValue;
  data: Prisma.JsonValue;
  metadata: Prisma.JsonValue;
  userId: string | null;
  idempotencyKey: string | null;
  errorMessage: string | null;
  attempt: number;
  maxAttempts: number;
  provider: string | null;
  providerMessageId: string | null;
  sentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): NotificationDeliveryRecord {
  return {
    ...row,
    recipient: asRecord(row.recipient) as NotificationRecipient,
    data: asRecord(row.data),
    metadata: row.metadata === null ? null : asRecord(row.metadata),
  };
}

function asRecord(value: Prisma.JsonValue): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}
