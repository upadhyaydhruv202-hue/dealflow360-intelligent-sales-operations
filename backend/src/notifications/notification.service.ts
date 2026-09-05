import {
  AUDIT_ACTIONS,
  JOBS,
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CHANNELS,
  NOTIFICATIONS,
} from '../constants';
import { ConflictError, ExternalServiceError, ValidationError } from '../errors';
import type { AuditService } from '../audit/audit.service';
import { recordNotificationDelivery, type MetricsSink } from '../observability';
import type { EmailService } from '../integrations/email';
import type { SmsService } from '../integrations/sms';
import type { JobQueue } from '../jobs/queue';
import { isRetryableJobError, UnretryableError } from '../jobs/retry';
import { IdempotencyStore } from '../lib/idempotency';
import { MemoryKvStore } from '../lib/kv';
import type { NotificationRepository } from '../repositories/notification.repository';
import type { UserRepository } from '../repositories/user.repository';
import { parseWithSchema } from '../schemas/parse';
import type { AppConfig } from '../types/config';
import type { InAppCreatedEvent } from '../realtime/realtime.types';
import { createDefaultChannelRegistry, type ChannelAdapterRegistry } from './channels';
import {
  createNotificationBodySchema,
  notificationDispatchJobPayloadSchema,
  sendNotificationBodySchema,
  updateNotificationPreferencesBodySchema,
} from './notification.schemas';
import {
  categoryForTemplate,
  createDefaultTemplateRegistry,
  renderNotificationTemplate,
  type NotificationTemplateRegistry,
} from './notification.templates';
import type {
  ChannelSendResult,
  NotificationCategory,
  NotificationChannel,
  NotificationDeliveryRecord,
  NotificationPriority,
  NotificationRecipient,
  RenderedNotification,
  SendNotificationInput,
  SendNotificationResult,
} from './notification.types';
import { NOTIFICATION_DISPATCH_JOB } from './notification.types';

export interface NotifyInput {
  userId: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  title: string;
  body: string;
  email?: boolean;
  async?: boolean;
  category?: NotificationCategory;
  priority?: NotificationPriority;
  idempotencyKey?: string;
}

export interface NotificationServiceOptions {
  notifications: NotificationRepository;
  users: UserRepository;
  email?: EmailService | null;
  sms?: SmsService | null;
  jobs?: JobQueue | null;
  idempotency?: IdempotencyStore | null;
  templates?: NotificationTemplateRegistry;
  channels?: ChannelAdapterRegistry;
  config?: AppConfig;
  audit?: AuditService | null;
  metrics?: MetricsSink | null;
  onInAppCreated?: (event: InAppCreatedEvent) => void;
}

export class NotificationService {
  private readonly templates: NotificationTemplateRegistry;
  private readonly channels: ChannelAdapterRegistry;
  private readonly idempotency: IdempotencyStore;

  constructor(private readonly options: NotificationServiceOptions) {
    this.templates = options.templates ?? createDefaultTemplateRegistry();
    this.channels = options.channels ?? createDefaultChannelRegistry(options);
    this.idempotency = options.idempotency ?? new IdempotencyStore(new MemoryKvStore());
  }

  registerJobs(): void {
    this.options.jobs?.process(NOTIFICATION_DISPATCH_JOB, async (payload) => {
      const job = parseWithSchema(notificationDispatchJobPayloadSchema, payload, {
        source: 'job',
        message: 'Invalid notification job payload',
      });
      if ('channel' in job && 'deliveryId' in job) {
        await this.deliverById(job.deliveryId);
        return;
      }
      await this.deliverLegacy(job);
    });
  }

  async sendNotification(input: SendNotificationInput): Promise<SendNotificationResult> {
    const parsed = parseWithSchema(sendNotificationBodySchema, {
      priority: 'normal',
      ...input,
    });
    const recipient = await this.resolveRecipient(parsed.channel, parsed.recipient);
    const template = this.templates.get(parsed.template);
    const category = categoryForTemplate(template, parsed.category);
    const data = parsed.data ?? {};

    if (parsed.idempotencyKey) {
      const existing = await this.options.notifications.findDeliveryByIdempotencyKey(parsed.idempotencyKey);
      if (existing) {
        return { delivery: existing, skipped: true, reason: 'duplicate' };
      }
    }

    const userId = recipient.userId;
    if (userId && !(await this.isCategoryEnabled(userId, category, parsed.channel))) {
      return this.skippedPreference(parsed, recipient, category);
    }

    this.assertRecipientForChannel(parsed.channel, recipient);
    const adapter = this.channels.get(parsed.channel);
    if (!adapter.ready) {
      throw new ExternalServiceError(`${parsed.channel} channel is not configured`, {
        provider: parsed.channel,
      });
    }

    const maxAttempts = attemptsForPriority(parsed.priority);
    let delivery: NotificationDeliveryRecord;
    try {
      delivery = await this.options.notifications.createDelivery({
        channel: parsed.channel,
        status: 'queued',
        priority: parsed.priority,
        category,
        template: parsed.template,
        recipient,
        data,
        metadata: parsed.metadata ?? null,
        userId: userId ?? null,
        idempotencyKey: parsed.idempotencyKey ?? null,
        maxAttempts,
      });
    } catch (error) {
      if (error instanceof ConflictError && parsed.idempotencyKey) {
        const existing = await this.options.notifications.findDeliveryByIdempotencyKey(parsed.idempotencyKey);
        if (existing) {
          return { delivery: existing, skipped: true, reason: 'duplicate' };
        }
      }
      throw error;
    }

    const enqueue = shouldEnqueue(parsed.priority, parsed.async, this.options.jobs, parsed.channel);
    if (enqueue && this.options.jobs) {
      const jobId = await this.options.jobs.enqueue(
        NOTIFICATION_DISPATCH_JOB,
        {
          ...parsed,
          recipient,
          category,
          deliveryId: delivery.id,
        },
        {
          attempts: maxAttempts,
          backoffMs: parsed.priority === 'low' ? JOBS.DEFAULT_BACKOFF_MS : 50,
          timeoutMs: JOBS.DEFAULT_TIMEOUT_MS,
          jobId: parsed.idempotencyKey ? `${NOTIFICATION_DISPATCH_JOB}:${parsed.idempotencyKey}` : undefined,
        },
      );
      return { delivery, queued: true, jobId };
    }

    const sent = await this.deliverById(delivery.id);
    return { delivery: sent };
  }

  async notify(input: NotifyInput) {
    const parsed = parseWithSchema(createNotificationBodySchema, {
      type: 'info',
      ...input,
    });

    if (parsed.async && this.options.jobs) {
      const jobId = await this.options.jobs.enqueue(NOTIFICATION_DISPATCH_JOB, parsed, {
        attempts: JOBS.DEFAULT_ATTEMPTS,
        backoffMs: JOBS.DEFAULT_BACKOFF_MS,
        timeoutMs: JOBS.DEFAULT_TIMEOUT_MS,
        jobId: parsed.idempotencyKey ? `${NOTIFICATION_DISPATCH_JOB}:${parsed.idempotencyKey}` : undefined,
      });
      return { queued: true as const, jobId };
    }

    return this.deliverLegacy(parsed);
  }

  async listForUser(userId: string, query: { page?: number; pageSize?: number; unreadOnly?: boolean }) {
    return this.options.notifications.listForUser({ userId, ...query });
  }

  unreadCount(userId: string) {
    return this.options.notifications.unreadCount(userId);
  }

  markRead(id: string, userId: string) {
    return this.options.notifications.markRead(id, userId);
  }

  markAllRead(userId: string) {
    return this.options.notifications.markAllRead(userId);
  }

  async getDelivery(id: string) {
    return this.options.notifications.findDeliveryByIdOrThrow(id);
  }

  async getPreferences(userId: string) {
    const stored = await this.options.notifications.listPreferences(userId);
    return {
      categories: [...NOTIFICATION_CATEGORIES],
      channels: [...NOTIFICATION_CHANNELS],
      mandatoryCategories: [...NOTIFICATIONS.MANDATORY_CATEGORIES],
      preferences: stored.map((item) => ({
        category: item.category,
        channel: item.channel,
        enabled: item.enabled,
      })),
    };
  }

  async updatePreferences(userId: string, input: { preferences: Array<{ category: NotificationCategory; channel: NotificationChannel; enabled: boolean }> }) {
    const parsed = parseWithSchema(updateNotificationPreferencesBodySchema, input);
    const updated = [];
    for (const item of parsed.preferences) {
      if (isMandatoryCategory(item.category) && !item.enabled) {
        throw new ValidationError('This notification category cannot be disabled', [
          { path: 'preferences.category', message: `${item.category} notifications are always delivered`, code: 'custom' },
        ]);
      }
      updated.push(await this.options.notifications.upsertPreference({ userId, ...item }));
    }
    return this.getPreferences(userId);
  }

  private async deliverLegacy(input: {
    userId: string;
    type: 'info' | 'success' | 'warning' | 'error';
    title: string;
    body: string;
    email?: boolean;
    category?: NotificationCategory;
    priority?: NotificationPriority;
    idempotencyKey?: string;
  }) {
    const inApp = await this.sendNotification({
      channel: 'in_app',
      recipient: { userId: input.userId },
      template: 'generic',
      data: { title: input.title, body: input.body, type: input.type },
      category: input.category ?? 'system',
      priority: input.priority ?? 'normal',
      idempotencyKey: input.idempotencyKey,
      async: false,
    });

    if (input.email) {
      await this.sendNotification({
        channel: 'email',
        recipient: { userId: input.userId },
        template: 'generic',
        data: { title: input.title, body: input.body, subject: input.title },
        category: input.category ?? 'system',
        priority: input.priority ?? 'normal',
        idempotencyKey: input.idempotencyKey ? `${input.idempotencyKey}:email` : undefined,
        async: false,
      });
    }

    if (inApp.skipped) {
      return { skipped: true as const, reason: inApp.reason, delivery: inApp.delivery };
    }

    const notificationId = inApp.delivery.providerMessageId;
    if (notificationId) {
      return this.options.notifications.findByIdForUser(notificationId, input.userId);
    }

    const listed = await this.options.notifications.listForUser({ userId: input.userId, page: 1, pageSize: 1 });
    return listed.items[0];
  }

  private async deliverById(deliveryId: string): Promise<NotificationDeliveryRecord> {
    const delivery = await this.options.notifications.findDeliveryByIdOrThrow(deliveryId);
    if (delivery.status === 'sent') {
      return delivery;
    }

    const adapter = this.channels.get(delivery.channel);
    const template = this.templates.get(delivery.template);
    const rendered = renderNotificationTemplate(template, delivery.data);
    const attempt = delivery.attempt + 1;

    await this.options.notifications.updateDelivery(delivery.id, {
      status: 'processing',
      attempt,
      errorMessage: null,
    });

    try {
      const result = await adapter.send({
        deliveryId: delivery.id,
        channel: delivery.channel,
        recipient: delivery.recipient,
        rendered,
        data: delivery.data,
        metadata: delivery.metadata ?? undefined,
        category: delivery.category,
        priority: delivery.priority,
        idempotencyKey: delivery.idempotencyKey ?? undefined,
        userId: delivery.userId ?? delivery.recipient.userId,
      });

      if (delivery.idempotencyKey) {
        await this.idempotency.complete(delivery.idempotencyKey);
      }

      const sent = await this.options.notifications.updateDelivery(delivery.id, {
        status: 'sent',
        provider: result.provider,
        providerMessageId: result.providerMessageId ?? result.inAppNotificationId ?? null,
        sentAt: new Date(),
        errorMessage: null,
      });
      await this.options.audit?.record({
        actorId: sent.userId ?? sent.recipient.userId,
        action: AUDIT_ACTIONS.NOTIFICATION_SENT,
        resource: 'notification',
        resourceId: sent.id,
        metadata: { channel: sent.channel, template: sent.template },
        status: 'succeeded',
      });
      recordNotificationDelivery(this.options.metrics, { channel: sent.channel, status: 'sent' });
      this.emitInAppCreated(delivery, rendered, result);
      return sent;
    } catch (error) {
      const retryable = isRetryableJobError(error) && attempt < delivery.maxAttempts;
      await this.options.notifications.updateDelivery(delivery.id, {
        status: retryable ? 'retrying' : 'failed',
        errorMessage: publicErrorMessage(error),
      });
      recordNotificationDelivery(this.options.metrics, {
        channel: delivery.channel,
        status: retryable ? 'retrying' : 'failed',
      });
      if (!retryable) {
        throw error instanceof UnretryableError ? error : new UnretryableError(publicErrorMessage(error), { cause: error });
      }
      throw error;
    }
  }

  private emitInAppCreated(
    delivery: NotificationDeliveryRecord,
    rendered: RenderedNotification,
    result: ChannelSendResult,
  ): void {
    if (delivery.channel !== 'in_app' || !this.options.onInAppCreated) {
      return;
    }
    const userId = delivery.userId ?? delivery.recipient.userId;
    const id = result.inAppNotificationId ?? result.providerMessageId;
    if (!userId || !id) {
      return;
    }
    try {
      this.options.onInAppCreated({
        id,
        userId,
        title: rendered.title,
        body: rendered.body,
        type: rendered.type,
        createdAt: new Date().toISOString(),
      });
    } catch {
      // Delivery already succeeded.
    }
  }

  private async resolveRecipient(
    channel: NotificationChannel,
    recipient: NotificationRecipient,
  ): Promise<NotificationRecipient> {
    if (!recipient.userId) {
      return recipient;
    }

    const user = await this.options.users.findByIdOrThrow(recipient.userId);
    return {
      ...recipient,
      email: recipient.email ?? (channel === 'email' ? user.email : recipient.email),
    };
  }

  private assertRecipientForChannel(channel: NotificationChannel, recipient: NotificationRecipient): void {
    if (channel === 'in_app' && !recipient.userId) {
      throw new ValidationError('Invalid recipient', [
        { path: 'recipient.userId', message: 'In-app notifications require recipient.userId', code: 'custom' },
      ]);
    }
    if (channel === 'email' && !recipient.email) {
      throw new ValidationError('Invalid recipient', [
        { path: 'recipient.email', message: 'Email notifications require recipient.email or recipient.userId', code: 'custom' },
      ]);
    }
    if (channel === 'sms' && !recipient.phone) {
      throw new ValidationError('Invalid recipient', [
        { path: 'recipient.phone', message: 'SMS notifications require recipient.phone', code: 'custom' },
      ]);
    }
    if (channel === 'push' && !recipient.deviceToken) {
      throw new ValidationError('Invalid recipient', [
        { path: 'recipient.deviceToken', message: 'Push notifications require recipient.deviceToken', code: 'custom' },
      ]);
    }
    if (channel === 'webhook' && !recipient.url) {
      throw new ValidationError('Invalid recipient', [
        { path: 'recipient.url', message: 'Webhook notifications require recipient.url', code: 'custom' },
      ]);
    }
  }

  private async isCategoryEnabled(
    userId: string,
    category: NotificationCategory,
    channel: NotificationChannel,
  ): Promise<boolean> {
    if (isMandatoryCategory(category)) {
      return true;
    }
    const preference = await this.options.notifications.findPreference(userId, category, channel);
    return preference?.enabled ?? true;
  }

  private async skippedPreference(
    parsed: {
      channel: NotificationChannel;
      template: string;
      data?: Record<string, unknown>;
      metadata?: Record<string, unknown>;
      priority: NotificationPriority;
      idempotencyKey?: string;
      recipient: NotificationRecipient;
    },
    recipient: NotificationRecipient,
    category: NotificationCategory,
  ): Promise<SendNotificationResult> {
    if (parsed.idempotencyKey) {
      const existing = await this.options.notifications.findDeliveryByIdempotencyKey(parsed.idempotencyKey);
      if (existing) {
        return { delivery: existing, skipped: true, reason: 'duplicate' };
      }
      const delivery = await this.options.notifications.createDelivery({
        channel: parsed.channel,
        status: 'failed',
        priority: parsed.priority,
        category,
        template: parsed.template,
        recipient,
        data: parsed.data ?? {},
        metadata: parsed.metadata ?? null,
        userId: recipient.userId ?? null,
        idempotencyKey: parsed.idempotencyKey,
        errorMessage: 'preference_disabled',
        attempt: 0,
        maxAttempts: 1,
      });
      await this.idempotency.complete(parsed.idempotencyKey);
      return { delivery, skipped: true, reason: 'preference_disabled' };
    }

    return {
      skipped: true,
      reason: 'preference_disabled',
      delivery: {
        id: 'skipped',
        channel: parsed.channel,
        status: 'failed',
        priority: parsed.priority,
        category,
        template: parsed.template,
        recipient,
        data: parsed.data ?? {},
        metadata: parsed.metadata ?? null,
        userId: recipient.userId ?? null,
        idempotencyKey: null,
        errorMessage: 'preference_disabled',
        attempt: 0,
        maxAttempts: 1,
        provider: null,
        providerMessageId: null,
        sentAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };
  }
}

export function createNotificationService(options: NotificationServiceOptions): NotificationService {
  const service = new NotificationService(options);
  service.registerJobs();
  return service;
}

function shouldEnqueue(
  priority: NotificationPriority,
  asyncFlag: boolean | undefined,
  jobs?: JobQueue | null,
  channel?: NotificationChannel,
): boolean {
  if (!jobs) {
    return false;
  }
  if (asyncFlag === false) {
    return false;
  }
  if (asyncFlag === true) {
    return true;
  }
  if (channel === 'in_app') {
    return false;
  }
  return !NOTIFICATIONS.HIGH_PRIORITIES.includes(priority as 'high' | 'critical');
}

function attemptsForPriority(priority: NotificationPriority): number {
  if (priority === 'critical' || priority === 'high') {
    return NOTIFICATIONS.HIGH_ATTEMPTS;
  }
  if (priority === 'low') {
    return NOTIFICATIONS.LOW_ATTEMPTS;
  }
  return NOTIFICATIONS.DEFAULT_ATTEMPTS;
}

function isMandatoryCategory(category: NotificationCategory): boolean {
  return (NOTIFICATIONS.MANDATORY_CATEGORIES as readonly string[]).includes(category);
}

function publicErrorMessage(error: unknown): string {
  if (error instanceof ValidationError || error instanceof ExternalServiceError || error instanceof UnretryableError) {
    return error.message;
  }
  if (error instanceof Error && error.message) {
    return error.message.slice(0, 200);
  }
  return 'Notification delivery failed';
}
