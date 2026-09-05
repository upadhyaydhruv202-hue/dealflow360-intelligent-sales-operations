import { randomUUID } from 'node:crypto';

import type { SendSmsInput, SentSms, SmsProvider } from '../sms.types';

export class MockSmsProvider implements SmsProvider {
  readonly name = 'mock';
  readonly sent: SentSms[] = [];
  readonly messages: Array<SendSmsInput & { id: string }> = [];
  failTimes = 0;
  permanentFailure = false;

  async send(input: SendSmsInput): Promise<SentSms> {
    if (this.permanentFailure) {
      const error = new Error('SMS provider rejected the message');
      (error as Error & { retryable: boolean }).retryable = false;
      throw error;
    }

    if (this.failTimes > 0) {
      this.failTimes -= 1;
      throw new Error('SMS provider temporarily unavailable');
    }

    const result: SentSms = {
      id: randomUUID(),
      to: input.to,
      provider: 'mock',
    };
    this.sent.push(result);
    this.messages.push({ ...input, id: result.id });
    return result;
  }
}
