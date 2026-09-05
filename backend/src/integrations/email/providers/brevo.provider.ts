import { randomUUID } from 'node:crypto';

import { ExternalServiceError } from '../../../errors';
import type { EmailProvider, ResolvedSendEmailInput, SentEmail } from '../email.types';
import { postJsonEmail, toRecipientList } from '../email.util';

export class BrevoEmailProvider implements EmailProvider {
  readonly name = 'brevo';

  constructor(
    private readonly options: {
      apiKey: string;
      from: string;
      timeoutMs: number;
      fetchImpl?: typeof fetch;
    },
  ) {}

  async send(input: ResolvedSendEmailInput): Promise<SentEmail> {
    if (!this.options.apiKey || !this.options.from) {
      throw new ExternalServiceError('Brevo is not configured', { provider: 'brevo' });
    }

    const body = await postJsonEmail({
      url: 'https://api.brevo.com/v3/smtp/email',
      timeoutMs: this.options.timeoutMs,
      fetchImpl: this.options.fetchImpl,
      headers: {
        'api-key': this.options.apiKey,
      },
      payload: {
        sender: { email: this.options.from },
        to: toRecipientList(input.to).map((email) => ({ email })),
        subject: input.subject,
        textContent: input.text,
        htmlContent: input.html,
        replyTo: input.replyTo ? { email: input.replyTo } : undefined,
        attachment: input.attachments?.map((item) => ({
          name: item.filename,
          content: item.content,
        })),
      },
      provider: 'brevo',
    });

    const messageId = typeof body.messageId === 'string' ? body.messageId : undefined;
    return {
      id: messageId && messageId ? messageId : randomUUID(),
      to: toRecipientList(input.to),
      subject: input.subject,
      provider: 'brevo',
    };
  }
}
