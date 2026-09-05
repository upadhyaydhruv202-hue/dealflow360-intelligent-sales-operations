import {
  JOB_NAMES,
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_DELIVERY_STATUSES,
  NOTIFICATION_PRIORITIES,
  type NotificationCategoryName,
  type NotificationChannelName,
  type NotificationDeliveryStatusName,
  type NotificationPriorityName,
} from '../constants';

export type NotificationChannel = NotificationChannelName;
export type NotificationPriority = NotificationPriorityName;
export type NotificationCategory = NotificationCategoryName;
export type NotificationDeliveryStatus = NotificationDeliveryStatusName;
export type InAppNotificationType = 'info' | 'success' | 'warning' | 'error';

export const NOTIFICATION_CHANNEL_VALUES = NOTIFICATION_CHANNELS;
export const NOTIFICATION_PRIORITY_VALUES = NOTIFICATION_PRIORITIES;
export const NOTIFICATION_CATEGORY_VALUES = NOTIFICATION_CATEGORIES;
export const NOTIFICATION_STATUS_VALUES = NOTIFICATION_DELIVERY_STATUSES;

export interface NotificationRecipient {
  userId?: string;
  email?: string;
  phone?: string;
  deviceToken?: string;
  url?: string;
}

export interface SendNotificationInput {
  channel: NotificationChannel;
  recipient: NotificationRecipient;
  template: string;
  data?: Record<string, unknown>;
  priority?: NotificationPriority;
  metadata?: Record<string, unknown>;
  category?: NotificationCategory;
  idempotencyKey?: string;
  async?: boolean;
}

export interface RenderedNotification {
  title: string;
  body: string;
  subject: string;
  html?: string;
  sms: string;
  type: InAppNotificationType;
}

export interface ChannelSendResult {
  provider: string;
  providerMessageId?: string;
  inAppNotificationId?: string;
}

export interface ChannelSendMessage {
  deliveryId: string;
  channel: NotificationChannel;
  recipient: NotificationRecipient;
  rendered: RenderedNotification;
  data: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  category: NotificationCategory;
  priority: NotificationPriority;
  idempotencyKey?: string;
  userId?: string;
}

export interface ChannelAdapter {
  readonly channel: NotificationChannel;
  readonly ready: boolean;
  send(message: ChannelSendMessage): Promise<ChannelSendResult>;
}

export interface NotificationTemplate {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  emailSubject?: string;
  emailHtml?: string;
  sms?: string;
  type?: InAppNotificationType;
}

export interface NotificationDeliveryRecord {
  id: string;
  channel: NotificationChannel;
  status: NotificationDeliveryStatus;
  priority: NotificationPriority;
  category: NotificationCategory;
  template: string;
  recipient: NotificationRecipient;
  data: Record<string, unknown>;
  metadata: Record<string, unknown> | null;
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
}

export interface SendNotificationResult {
  delivery: NotificationDeliveryRecord;
  queued?: boolean;
  jobId?: string;
  skipped?: boolean;
  reason?: 'preference_disabled' | 'duplicate';
}

export const NOTIFICATION_DISPATCH_JOB = JOB_NAMES.NOTIFICATION_DISPATCH;
