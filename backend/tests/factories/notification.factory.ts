import { randomUUID } from 'node:crypto';

import type { Repositories } from '../../src/repositories';
import type { CreateNotificationInput } from '../../src/repositories/notification.repository';

export interface BuildNotificationInput extends Partial<CreateNotificationInput> {
  userId?: string;
}

export function buildNotification(overrides: BuildNotificationInput = {}): CreateNotificationInput {
  return {
    userId: overrides.userId ?? randomUUID(),
    type: overrides.type ?? 'info',
    title: overrides.title ?? 'Factory notification',
    body: overrides.body ?? 'Reusable inbox fixture.',
    category: overrides.category ?? 'system',
    priority: overrides.priority ?? 'normal',
    metadata: overrides.metadata ?? { source: 'factory' },
    deliveryId: overrides.deliveryId,
    readAt: overrides.readAt,
  };
}

export async function createNotification(repos: Repositories, overrides: BuildNotificationInput) {
  if (!overrides.userId) {
    throw new Error('createNotification requires userId');
  }

  return repos.notifications.create(buildNotification(overrides));
}
