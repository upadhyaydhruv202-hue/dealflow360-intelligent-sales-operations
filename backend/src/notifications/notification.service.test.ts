import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { loadConfig } from '../config';
import { ValidationError } from '../errors';
import { MockEmailProvider } from '../integrations/email/providers/mock.provider';
import { EmailService } from '../integrations/email/email.service';
import { MockSmsProvider } from '../integrations/sms/providers/mock.provider';
import { SmsService } from '../integrations/sms/sms.service';
import { silentLogger } from '../integrations/ai/ai.test-helpers';
import { createJobQueue } from '../jobs/queue';
import { UnretryableError } from '../jobs/retry';
import type { NotificationRepository } from '../repositories/notification.repository';
import { createDefaultChannelRegistry, MockPushProvider, MockWebhookProvider } from './channels';
import { createNotificationService } from './notification.service';
import type { NotificationDeliveryRecord } from './notification.types';

const USER_ID = '11111111-1111-4111-8111-111111111111';

describe('NotificationService', () => {
  it('sends a valid in-app notification', async () => {
    const { service, store } = createHarness();
    const result = await service.sendNotification({
      channel: 'in_app',
      recipient: { userId: USER_ID },
      template: 'welcome',
      data: { appName: 'Starter Kit', displayName: 'Ada' },
      priority: 'normal',
    });

    expect(result.skipped).toBeUndefined();
    expect(result.delivery.status).toBe('sent');
    expect(store.inbox).toHaveLength(1);
    expect(store.inbox[0]?.title).toBe('Welcome to Starter Kit');
  });

  it('retries a transient provider failure then marks sent', async () => {
    const push = new MockPushProvider();
    push.failTimes = 1;
    const jobs = createJobQueue();
    const { service } = createHarness({ push, jobs });

    const result = await service.sendNotification({
      channel: 'push',
      recipient: { deviceToken: 'device-1' },
      template: 'generic',
      data: { title: 'Ping', body: 'Hello' },
      async: true,
    });

    expect(result.queued).toBe(true);
    await jobs.waitForIdle();
    const delivery = await service.getDelivery(result.delivery.id);
    expect(delivery.status).toBe('sent');
    expect(push.sent).toHaveLength(1);
    expect(delivery.attempt).toBeGreaterThanOrEqual(2);
  });

  it('does not retry a permanent provider failure', async () => {
    const push = new MockPushProvider();
    push.permanentFailure = true;
    const { service, store } = createHarness({ push });

    await expect(
      service.sendNotification({
        channel: 'push',
        recipient: { deviceToken: 'device-1' },
        template: 'generic',
        data: { title: 'Ping', body: 'Hello' },
        async: false,
      }),
    ).rejects.toBeInstanceOf(UnretryableError);

    const delivery = [...store.deliveries.values()][0];
    expect(delivery?.status).toBe('failed');
    expect(push.sent).toHaveLength(0);
  });

  it('skips a disabled preference', async () => {
    const { service, store } = createHarness();
    await service.updatePreferences(USER_ID, {
      preferences: [{ category: 'marketing', channel: 'email', enabled: false }],
    });

    const result = await service.sendNotification({
      channel: 'email',
      recipient: { userId: USER_ID },
      template: 'marketing',
      data: { title: 'Sale', body: '20% off' },
    });

    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('preference_disabled');
    expect(store.email.sent).toHaveLength(0);
  });

  it('still delivers mandatory security alerts when the category is disabled', async () => {
    const { service } = createHarness();
    await expect(
      service.updatePreferences(USER_ID, {
        preferences: [{ category: 'security_alerts', channel: 'in_app', enabled: false }],
      }),
    ).rejects.toBeInstanceOf(ValidationError);

    const result = await service.sendNotification({
      channel: 'in_app',
      recipient: { userId: USER_ID },
      template: 'security-alert',
      data: { body: 'New login from a new device' },
    });
    expect(result.delivery.status).toBe('sent');
  });

  it('rejects an invalid recipient', async () => {
    const { service } = createHarness();
    await expect(
      service.sendNotification({
        channel: 'email',
        recipient: { phone: '+15551234567' },
        template: 'generic',
        data: { title: 'Hi', body: 'There' },
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('does not send a duplicate event twice', async () => {
    const { service, store } = createHarness();
    const input = {
      channel: 'in_app' as const,
      recipient: { userId: USER_ID },
      template: 'generic',
      data: { title: 'Order', body: 'Packed' },
      idempotencyKey: 'order.updated:42',
    };

    const first = await service.sendNotification(input);
    const second = await service.sendNotification(input);

    expect(first.delivery.status).toBe('sent');
    expect(second.skipped).toBe(true);
    expect(second.reason).toBe('duplicate');
    expect(store.inbox).toHaveLength(1);
  });

  it('creates an in-app notification and can send email via notify()', async () => {
    const { service, store } = createHarness();
    const result = await service.notify({
      userId: USER_ID,
      title: 'Welcome',
      body: 'Your account is ready',
      email: true,
    });

    expect(result).not.toHaveProperty('queued');
    expect(store.inbox).toHaveLength(1);
    expect(store.email.sent).toHaveLength(1);
    expect(store.email.sent[0]?.to).toEqual(['ada@example.com']);
  });

  it('enqueues notification.dispatch when async is true', async () => {
    const jobs = createJobQueue();
    const { service, store } = createHarness({ jobs });
    const result = await service.notify({
      userId: USER_ID,
      title: 'Queued',
      body: 'Deliver later',
      async: true,
    });

    expect(result).toMatchObject({ queued: true, jobId: expect.any(String) });
    await jobs.waitForIdle();
    expect(store.inbox).toHaveLength(1);
  });

  it('sends SMS and webhook through mocked providers', async () => {
    const webhook = new MockWebhookProvider();
    const { service, store } = createHarness({ webhook });

    const sms = await service.sendNotification({
      channel: 'sms',
      recipient: { phone: '+15551234567' },
      template: 'order-updated',
      data: { orderId: 'A-1', status: 'shipped' },
      async: false,
    });
    expect(sms.delivery.status).toBe('sent');
    expect(store.sms.sent).toHaveLength(1);

    const hook = await service.sendNotification({
      channel: 'webhook',
      recipient: { url: 'https://hooks.example.com/notify' },
      template: 'generic',
      data: { title: 'Event', body: 'Fired' },
      async: false,
    });
    expect(hook.delivery.status).toBe('sent');
    expect(webhook.sent).toHaveLength(1);
  });

  it('marks in-app notifications read', async () => {
    const { service, store } = createHarness();
    await service.sendNotification({
      channel: 'in_app',
      recipient: { userId: USER_ID },
      template: 'generic',
      data: { title: 'One', body: 'First' },
    });
    expect(await service.unreadCount(USER_ID)).toBe(1);
    const item = store.inbox[0];
    if (!item) {
      throw new Error('expected notification');
    }
    await service.markRead(item.id, USER_ID);
    expect(await service.unreadCount(USER_ID)).toBe(0);
    await service.sendNotification({
      channel: 'in_app',
      recipient: { userId: USER_ID },
      template: 'generic',
      data: { title: 'Two', body: 'Second' },
    });
    const all = await service.markAllRead(USER_ID);
    expect(all.count).toBe(1);
  });
});

function createHarness(options: {
  jobs?: ReturnType<typeof createJobQueue>;
  push?: MockPushProvider;
  webhook?: MockWebhookProvider;
} = {}) {
  const emailProvider = new MockEmailProvider();
  const smsProvider = new MockSmsProvider();
  const store = new MemoryNotificationStore(emailProvider, smsProvider);
  const config = loadConfig({ NODE_ENV: 'test', DEMO_MODE: 'true', FEATURE_SMS: 'true' });
  const email = new EmailService({ config, logger: silentLogger, provider: emailProvider });
  const sms = new SmsService({ config, provider: smsProvider });
  const service = createNotificationService({
    notifications: store as unknown as NotificationRepository,
    users: {
      findByIdOrThrow: async () => ({
        id: USER_ID,
        email: 'ada@example.com',
        displayName: 'Ada',
        status: 'active' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    } as never,
    email,
    sms,
    jobs: options.jobs,
    config,
    channels: createDefaultChannelRegistry({
      notifications: store as unknown as NotificationRepository,
      email,
      sms,
      config,
      pushProvider: options.push,
      webhookProvider: options.webhook,
    }),
  });

  return { service, store, emailProvider, smsProvider };
}

class MemoryNotificationStore {
  readonly inbox: Array<{
    id: string;
    userId: string;
    type: 'info' | 'success' | 'warning' | 'error';
    title: string;
    body: string;
    category: string;
    priority: string;
    metadata: Record<string, unknown> | null;
    deliveryId: string | null;
    readAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }> = [];
  readonly deliveries = new Map<string, NotificationDeliveryRecord>();
  readonly preferences = new Map<string, { userId: string; category: string; channel: string; enabled: boolean }>();

  constructor(
    readonly email: MockEmailProvider,
    readonly sms: MockSmsProvider,
  ) {}

  async create(input: {
    userId: string;
    type: 'info' | 'success' | 'warning' | 'error';
    title: string;
    body: string;
    category?: string;
    priority?: string;
    metadata?: Record<string, unknown> | null;
    deliveryId?: string | null;
  }) {
    const row = {
      id: randomUUID(),
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      category: input.category ?? 'system',
      priority: input.priority ?? 'normal',
      metadata: input.metadata ?? null,
      deliveryId: input.deliveryId ?? null,
      readAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.inbox.push(row);
    return row;
  }

  async listForUser(input: { userId: string; unreadOnly?: boolean; page?: number; pageSize?: number }) {
    const items = this.inbox.filter((item) => item.userId === input.userId && (!input.unreadOnly || !item.readAt));
    return { items, meta: { page: 1, pageSize: items.length, totalItems: items.length, totalPages: 1 } };
  }

  async findByIdForUser(id: string, userId: string) {
    const item = this.inbox.find((row) => row.id === id && row.userId === userId);
    if (!item) {
      throw new Error('Notification not found');
    }
    return item;
  }

  async markRead(id: string, userId: string) {
    const item = await this.findByIdForUser(id, userId);
    item.readAt = item.readAt ?? new Date();
    return item;
  }

  async markAllRead(userId: string) {
    let count = 0;
    for (const item of this.inbox) {
      if (item.userId === userId && !item.readAt) {
        item.readAt = new Date();
        count += 1;
      }
    }
    return { count };
  }

  async unreadCount(userId: string) {
    return this.inbox.filter((item) => item.userId === userId && !item.readAt).length;
  }

  async createDelivery(input: Omit<NotificationDeliveryRecord, 'id' | 'createdAt' | 'updatedAt' | 'provider' | 'providerMessageId' | 'sentAt' | 'errorMessage'> & {
    errorMessage?: string | null;
    provider?: string | null;
    providerMessageId?: string | null;
    sentAt?: Date | null;
  }) {
    const now = new Date();
    const row: NotificationDeliveryRecord = {
      id: randomUUID(),
      channel: input.channel,
      status: input.status,
      priority: input.priority,
      category: input.category,
      template: input.template,
      recipient: input.recipient,
      data: input.data,
      metadata: input.metadata ?? null,
      userId: input.userId ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
      errorMessage: input.errorMessage ?? null,
      attempt: input.attempt ?? 0,
      maxAttempts: input.maxAttempts ?? 3,
      provider: input.provider ?? null,
      providerMessageId: input.providerMessageId ?? null,
      sentAt: input.sentAt ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.deliveries.set(row.id, row);
    return row;
  }

  async updateDelivery(id: string, input: Partial<NotificationDeliveryRecord>) {
    const current = this.deliveries.get(id);
    if (!current) {
      throw new Error('Notification delivery not found');
    }
    const next = { ...current, ...input, updatedAt: new Date() };
    this.deliveries.set(id, next);
    return next;
  }

  async findDeliveryById(id: string) {
    return this.deliveries.get(id) ?? null;
  }

  async findDeliveryByIdOrThrow(id: string) {
    const row = this.deliveries.get(id);
    if (!row) {
      throw new Error('Notification delivery not found');
    }
    return row;
  }

  async findDeliveryByIdempotencyKey(key: string) {
    return [...this.deliveries.values()].find((row) => row.idempotencyKey === key) ?? null;
  }

  async listPreferences(userId: string) {
    return [...this.preferences.values()].filter((item) => item.userId === userId);
  }

  async findPreference(userId: string, category: string, channel: string) {
    return this.preferences.get(`${userId}:${category}:${channel}`) ?? null;
  }

  async upsertPreference(input: { userId: string; category: string; channel: string; enabled: boolean }) {
    const row = { ...input };
    this.preferences.set(`${input.userId}:${input.category}:${input.channel}`, row);
    return row;
  }
}
