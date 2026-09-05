import { randomUUID } from 'node:crypto';

import nodemailer, { type Transporter } from 'nodemailer';

import { ExternalServiceError } from '../../../errors';
import type { AppConfig } from '../../../types/config';
import type { EmailProvider, ResolvedSendEmailInput, SentEmail } from '../email.types';
import { toAttachmentBuffers, toRecipientList } from '../email.util';

export class SmtpEmailProvider implements EmailProvider {
  readonly name = 'smtp';
  private transporter?: Transporter;

  constructor(private readonly smtp: AppConfig['email']['smtp']) {}

  async send(input: ResolvedSendEmailInput): Promise<SentEmail> {
    if (!this.smtp.host || !this.smtp.from) {
      throw new ExternalServiceError('SMTP is not configured', { provider: 'smtp' });
    }

    try {
      const info = await this.getTransporter().sendMail({
        from: this.smtp.from,
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html,
        replyTo: input.replyTo,
        attachments: toAttachmentBuffers(input.attachments).map((item) => ({
          filename: item.filename,
          content: item.content,
          contentType: item.contentType,
          cid: item.cid,
        })),
      });

      return {
        id: typeof info.messageId === 'string' && info.messageId ? info.messageId : randomUUID(),
        to: toRecipientList(input.to),
        subject: input.subject,
        provider: 'smtp',
      };
    } catch (error) {
      throw new ExternalServiceError('Failed to send email', {
        provider: 'smtp',
        cause: error instanceof Error ? error.message : 'send failed',
      });
    }
  }

  private getTransporter(): Transporter {
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: this.smtp.host,
        port: this.smtp.port,
        secure: this.smtp.port === 465,
        auth:
          this.smtp.user && this.smtp.password
            ? { user: this.smtp.user, pass: this.smtp.password }
            : undefined,
      });
    }

    return this.transporter;
  }
}
