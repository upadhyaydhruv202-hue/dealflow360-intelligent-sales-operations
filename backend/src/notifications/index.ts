export { createNotificationService, NotificationService } from './notification.service';
export type { NotifyInput, NotificationServiceOptions } from './notification.service';
export {
  createNotificationBodySchema,
  notificationDispatchJobPayloadSchema,
  notificationIdParamsSchema,
  notificationListQuerySchema,
  sendNotificationBodySchema,
  updateNotificationPreferencesBodySchema,
  NOTIFICATION_TYPES,
} from './notification.schemas';
export { NOTIFICATION_DISPATCH_JOB } from './notification.types';
export { createDefaultTemplateRegistry, NotificationTemplateRegistry } from './notification.templates';
export {
  createDefaultChannelRegistry,
  ChannelAdapterRegistry,
  MockPushProvider,
  MockWebhookProvider,
} from './channels';
export type {
  SendNotificationInput,
  SendNotificationResult,
  NotificationChannel,
  NotificationPriority,
  NotificationCategory,
  ChannelAdapter,
} from './notification.types';
