import type { EmailService } from '../../integrations/email';
import { ExternalServiceError } from '../../errors';
import type { ChannelAdapter, ChannelSendMessage, ChannelSendResult } from '../notification.types';

export class EmailChannelAdapter implements ChannelAdapter {
  readonly channel = 'email' as const;

  constructor(private readonly email: EmailService | null) {}

  get ready(): boolean {
    return Boolean(this.email?.ready);
  }

  async send(message: ChannelSendMessage): Promise<ChannelSendResult> {
    if (!this.email?.ready) {
      throw new ExternalServiceError('Email channel is not configured', { provider: 'email' });
    }

    const to = message.recipient.email;
    if (!to) {
      throw new ExternalServiceError('Email recipient is missing', { provider: 'email' });
    }

    const sent = await this.email.deliver({
      to,
      subject: message.rendered.subject,
      text: message.rendered.body,
      html: message.rendered.html,
      idempotencyKey: message.idempotencyKey ? `notification.email:${message.idempotencyKey}` : undefined,
    });

    return { provider: sent.provider, providerMessageId: sent.id };
  }
}
