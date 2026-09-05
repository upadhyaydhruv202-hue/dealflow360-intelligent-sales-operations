import { randomUUID } from 'node:crypto';

import type { EmailProvider, ResolvedSendEmailInput, SendEmailInput, SentEmail } from '../email.types';
import { toRecipientList } from '../email.util';

export class MockEmailProvider implements EmailProvider {
  readonly name = 'mock';
  readonly sent: SentEmail[] = [];
  readonly messages: Array<ResolvedSendEmailInput & { id: string }> = [];

  async send(input: ResolvedSendEmailInput): Promise<SentEmail> {
    const to = toRecipientList(input.to);
    const result: SentEmail = {
      id: randomUUID(),
      to,
      subject: input.subject,
      provider: 'mock',
    };
    this.sent.push(result);
    this.messages.push({ ...input, id: result.id });
    return result;
  }
}

export type MockEmailMessage = SendEmailInput & { id: string };
