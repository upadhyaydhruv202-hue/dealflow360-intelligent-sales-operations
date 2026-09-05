import { randomUUID } from 'node:crypto';

import { ValidationError } from '../../errors';
import type { ChannelAdapter, ChannelSendMessage, ChannelSendResult } from '../notification.types';

export interface PushProvider {
  readonly name: string;
  send(input: { to: string; title: string; body: string; data?: Record<string, unknown> }): Promise<{ id: string }>;
}

export class MockPushProvider implements PushProvider {
  readonly name = 'mock';
  readonly sent: Array<{ id: string; to: string; title: string; body: string }> = [];
  failTimes = 0;
  permanentFailure = false;

  async send(input: { to: string; title: string; body: string }): Promise<{ id: string }> {
    if (this.permanentFailure) {
      const error = new Error('Push provider rejected the message');
      (error as Error & { retryable: boolean }).retryable = false;
      throw error;
    }
    if (this.failTimes > 0) {
      this.failTimes -= 1;
      throw new Error('Push provider temporarily unavailable');
    }
    const result = { id: randomUUID(), to: input.to, title: input.title, body: input.body };
    this.sent.push(result);
    return { id: result.id };
  }
}

export class PushChannelAdapter implements ChannelAdapter {
  readonly channel = 'push' as const;
  readonly ready = true;

  constructor(private readonly provider: PushProvider = new MockPushProvider()) {}

  async send(message: ChannelSendMessage): Promise<ChannelSendResult> {
    const to = message.recipient.deviceToken;
    if (!to) {
      throw new ValidationError('Push notifications require a device token', [
        { path: 'recipient.deviceToken', message: 'Provide recipient.deviceToken', code: 'custom' },
      ]);
    }

    const sent = await this.provider.send({
      to,
      title: message.rendered.title,
      body: message.rendered.body,
      data: message.data,
    });

    return { provider: this.provider.name, providerMessageId: sent.id };
  }
}
