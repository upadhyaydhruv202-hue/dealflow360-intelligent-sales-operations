import { z } from 'zod';

import { NOTIFICATIONS } from '../constants';
import { e164PhoneSchema, emailSchema, idSchema, paginationQuerySchema, requestIdSchema, urlSchema } from '../schemas/common';
import {
  NOTIFICATION_CATEGORY_VALUES,
  NOTIFICATION_CHANNEL_VALUES,
  NOTIFICATION_PRIORITY_VALUES,
} from './notification.types';

export const notificationRecipientSchema = z
  .object({
    userId: idSchema.optional(),
    email: emailSchema.optional(),
    phone: e164PhoneSchema.optional(),
    deviceToken: z.string().trim().min(1).max(4096).optional(),
    url: urlSchema.optional(),
  })
  .refine(
    (value) => Boolean(value.userId || value.email || value.phone || value.deviceToken || value.url),
    { message: 'Recipient must include userId, email, phone, deviceToken, or url' },
  );

export const notificationDataSchema = z
  .record(z.string().min(1).max(64), z.unknown())
  .refine((value) => Object.keys(value).length <= NOTIFICATIONS.MAX_DATA_KEYS, {
    message: `Notification data may include at most ${NOTIFICATIONS.MAX_DATA_KEYS} keys`,
  });

export const sendNotificationBodySchema = z.object({
  channel: z.enum(NOTIFICATION_CHANNEL_VALUES),
  recipient: notificationRecipientSchema,
  template: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[a-z][a-z0-9._-]*$/),
  data: notificationDataSchema.optional(),
  priority: z.enum(NOTIFICATION_PRIORITY_VALUES).default('normal'),
  metadata: notificationDataSchema.optional(),
  category: z.enum(NOTIFICATION_CATEGORY_VALUES).optional(),
  idempotencyKey: z.string().trim().min(1).max(128).optional(),
  async: z.boolean().optional(),
});

export const createNotificationBodySchema = z.object({
  userId: idSchema,
  type: z.enum(['info', 'success', 'warning', 'error']).default('info'),
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(4000),
  email: z.boolean().optional(),
  async: z.boolean().optional(),
  category: z.enum(NOTIFICATION_CATEGORY_VALUES).optional(),
  priority: z.enum(NOTIFICATION_PRIORITY_VALUES).optional(),
  idempotencyKey: z.string().trim().min(1).max(128).optional(),
});

export const notificationIdParamsSchema = z.object({
  id: idSchema,
});

export const notificationListQuerySchema = paginationQuerySchema.extend({
  unreadOnly: z.preprocess((value) => {
    if (value === undefined || value === '') {
      return undefined;
    }
    if (value === true || value === 'true' || value === '1') {
      return true;
    }
    if (value === false || value === 'false' || value === '0') {
      return false;
    }
    return value;
  }, z.boolean().optional()),
});

export const notificationPreferenceItemSchema = z.object({
  category: z.enum(NOTIFICATION_CATEGORY_VALUES),
  channel: z.enum(NOTIFICATION_CHANNEL_VALUES),
  enabled: z.boolean(),
});

export const updateNotificationPreferencesBodySchema = z.object({
  preferences: z.array(notificationPreferenceItemSchema).min(1).max(40),
});

export const notificationDispatchJobPayloadSchema = z.union([
  sendNotificationBodySchema.extend({
    deliveryId: idSchema,
    requestId: requestIdSchema.optional(),
  }),
  createNotificationBodySchema.extend({
    requestId: requestIdSchema.optional(),
  }),
]);

export const NOTIFICATION_TYPES = ['info', 'success', 'warning', 'error'] as const;
