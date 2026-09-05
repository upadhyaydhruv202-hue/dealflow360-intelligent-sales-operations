import type { NotificationRepository } from '../../repositories/notification.repository';
import { ValidationError } from '../../errors';
import type { ChannelAdapter, ChannelSendMessage, ChannelSendResult } from '../notification.types';

export class InAppChannelAdapter implements ChannelAdapter {
  readonly channel = 'in_app' as const;
  readonly ready = true;

  constructor(private readonly notifications: NotificationRepository) {}

  async send(message: ChannelSendMessage): Promise<ChannelSendResult> {
    const userId = message.userId ?? message.recipient.userId;
    if (!userId) {
      throw new ValidationError('In-app notifications require a userId', [
        { path: 'recipient.userId', message: 'Provide recipient.userId', code: 'custom' },
      ]);
    }

    const created = await this.notifications.create({
      userId,
      type: message.rendered.type,
      title: message.rendered.title,
      body: message.rendered.body,
      category: message.category,
      priority: message.priority,
      metadata: message.metadata ?? null,
      deliveryId: message.deliveryId,
    });

    return { provider: 'in_app', providerMessageId: created.id, inAppNotificationId: created.id };
  }
}
