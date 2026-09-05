import { randomUUID } from 'node:crypto';

import { ExternalServiceError } from '../../../errors';
import type { EmailProvider, ResolvedSendEmailInput, SentEmail } from '../email.types';
import { postJsonEmail, toRecipientList } from '../email.util';

export class ResendEmailProvider implements EmailProvider {
  readonly name = 'resend';

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
      throw new ExternalServiceError('Resend is not configured', { provider: 'resend' });
    }

    const body = await postJsonEmail({
      url: 'https://api.resend.com/emails',
      timeoutMs: this.options.timeoutMs,
      fetchImpl: this.options.fetchImpl,
      headers: {
        authorization: `Bearer ${this.options.apiKey}`,
      },
      payload: {
        from: this.options.from,
        to: toRecipientList(input.to),
        subject: input.subject,
        text: input.text,
        html: input.html,
        reply_to: input.replyTo,
        attachments: input.attachments?.map((item) => ({
          filename: item.filename,
          content: item.content,
          content_type: item.contentType,
        })),
      },
      provider: 'resend',
    });

    return {
      id: typeof body.id === 'string' && body.id ? body.id : randomUUID(),
      to: toRecipientList(input.to),
      subject: input.subject,
      provider: 'resend',
    };
  }
}
