import { ConflictError } from '../errors';
import { shouldMockExternalIntegrations } from '../features';
import type { EmailService } from '../integrations/email';
import type { NotificationRepository } from '../repositories/notification.repository';
import type { AppConfig } from '../types/config';
import type { ProblemHost } from './types';

export type CustomerEmailSender = NonNullable<NonNullable<ProblemHost['notifications']>['sendCustomerEmail']>;

export function isCustomerEmailDeliverable(config: AppConfig, email?: EmailService | null): boolean {
  if (!email || !config.email.enabled) {
    return false;
  }
  if (shouldMockExternalIntegrations(config) || email.providerName === 'mock' || config.email.provider === 'mock') {
    return false;
  }
  if (config.email.provider === 'smtp') {
    return Boolean(config.email.smtp.host && (config.email.from || config.email.smtp.from));
  }
  if (config.email.provider === 'resend') {
    return Boolean(config.email.resend.apiKey);
  }
  if (config.email.provider === 'brevo') {
    return Boolean(config.email.brevo.apiKey);
  }
  return false;
}

export function createCustomerEmailSender(options: {
  config: AppConfig;
  email?: EmailService | null;
  notifications?: NotificationRepository | null;
}): CustomerEmailSender {
  return async (input) => {
    const existing = input.idempotencyKey
      ? await options.notifications?.findDeliveryByIdempotencyKey(input.idempotencyKey)
      : null;
    if (existing?.status === 'sent') {
      return {
        status: 'sent',
        provider: existing.provider ?? undefined,
        providerMessageId: existing.providerMessageId ?? undefined,
        notificationDeliveryId: existing.id,
      };
    }
    if (existing?.status === 'processing') {
      return {
        status: 'skipped',
        notificationDeliveryId: existing.id,
        error: existing.errorMessage ?? undefined,
      };
    }

    const deliverable = isCustomerEmailDeliverable(options.config, options.email);
    const template = input.eventType === 'final_invoice' ? 'quote-final-invoice' : 'quote-prelim-invoice';
    let deliveryId = existing?.id;

    if (options.notifications && !deliveryId) {
      try {
        const delivery = await options.notifications.createDelivery({
          channel: 'email',
          status: deliverable ? 'processing' : 'queued',
          priority: 'high',
          category: 'order_updates',
          template,
          recipient: { email: input.to },
          data: input.data ?? {},
          metadata: { quoteId: input.quoteId, eventType: input.eventType, source: 'dealflow' },
          idempotencyKey: input.idempotencyKey,
          errorMessage: deliverable ? null : 'Email provider is not configured',
        });
        deliveryId = delivery.id;
      } catch (error) {
        if (error instanceof ConflictError && input.idempotencyKey) {
          const duplicate = await options.notifications.findDeliveryByIdempotencyKey(input.idempotencyKey);
          if (duplicate?.status === 'sent') {
            return {
              status: 'sent',
              provider: duplicate.provider ?? undefined,
              providerMessageId: duplicate.providerMessageId ?? undefined,
              notificationDeliveryId: duplicate.id,
            };
          }
          deliveryId = duplicate?.id;
        } else {
          throw error;
        }
      }
    }

    if (!deliverable || !options.email) {
      return {
        status: 'not_configured',
        notificationDeliveryId: deliveryId,
        error: 'Email provider is not configured',
      };
    }

    try {
      const sent = await options.email.send({
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html,
        attachments: input.attachments?.map((item) => ({
          filename: item.filename,
          content: item.contentBase64,
          contentType: item.contentType,
        })),
        idempotencyKey: input.idempotencyKey,
      });
      if ('queued' in sent) {
        return {
          status: 'failed',
          notificationDeliveryId: deliveryId,
          error: 'Customer email must send inline, not through the job queue',
        };
      }
      if (deliveryId && options.notifications) {
        await options.notifications.updateDelivery(deliveryId, {
          status: 'sent',
          provider: sent.provider,
          providerMessageId: sent.id,
          sentAt: new Date(),
          errorMessage: null,
        });
      }
      return {
        status: 'sent',
        provider: sent.provider,
        providerMessageId: sent.id,
        notificationDeliveryId: deliveryId,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Email delivery failed';
      if (deliveryId && options.notifications) {
        await options.notifications.updateDelivery(deliveryId, {
          status: 'failed',
          errorMessage: message,
        });
      }
      return {
        status: 'failed',
        notificationDeliveryId: deliveryId,
        error: message,
      };
    }
  };
}
