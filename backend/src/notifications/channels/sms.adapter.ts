import type { SmsService } from '../../integrations/sms';
import { ExternalServiceError } from '../../errors';
import type { ChannelAdapter, ChannelSendMessage, ChannelSendResult } from '../notification.types';

export class SmsChannelAdapter implements ChannelAdapter {
  readonly channel = 'sms' as const;

  constructor(private readonly sms: SmsService | null) {}

  get ready(): boolean {
    return Boolean(this.sms?.ready);
  }

  async send(message: ChannelSendMessage): Promise<ChannelSendResult> {
    if (!this.sms?.ready) {
      throw new ExternalServiceError('SMS channel is not configured', { provider: 'sms' });
    }

    const to = message.recipient.phone;
    if (!to) {
      throw new ExternalServiceError('SMS recipient is missing', { provider: 'sms' });
    }

    const sent = await this.sms.deliver({
      to,
      text: message.rendered.sms,
      idempotencyKey: message.idempotencyKey ? `notification.sms:${message.idempotencyKey}` : undefined,
    });

    return { provider: sent.provider, providerMessageId: sent.id };
  }
}
