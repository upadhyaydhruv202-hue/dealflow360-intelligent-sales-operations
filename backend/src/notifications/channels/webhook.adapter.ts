import { randomUUID } from 'node:crypto';

import { NOTIFICATIONS } from '../../constants';
import { ExternalServiceError, ValidationError } from '../../errors';
import { fetchExternal } from '../../security';
import type { ChannelAdapter, ChannelSendMessage, ChannelSendResult } from '../notification.types';

export interface WebhookProvider {
  readonly name: string;
  send(input: {
    url: string;
    payload: Record<string, unknown>;
  }): Promise<{ id: string; status?: number }>;
}

export class MockWebhookProvider implements WebhookProvider {
  readonly name = 'mock';
  readonly sent: Array<{ id: string; url: string; payload: Record<string, unknown> }> = [];
  failTimes = 0;
  permanentFailure = false;

  async send(input: { url: string; payload: Record<string, unknown> }): Promise<{ id: string }> {
    if (this.permanentFailure) {
      const error = new Error('Webhook provider rejected the request');
      (error as Error & { retryable: boolean }).retryable = false;
      throw error;
    }
    if (this.failTimes > 0) {
      this.failTimes -= 1;
      throw new Error('Webhook provider temporarily unavailable');
    }
    const result = { id: randomUUID(), url: input.url, payload: input.payload };
    this.sent.push(result);
    return { id: result.id };
  }
}

export class HttpWebhookProvider implements WebhookProvider {
  readonly name = 'http';

  constructor(
    private readonly options: {
      timeoutMs?: number;
      fetchImpl?: typeof fetch;
    } = {},
  ) {}

  async send(input: { url: string; payload: Record<string, unknown> }): Promise<{ id: string; status?: number }> {
    try {
      const response = await fetchExternal(input.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input.payload),
        timeoutMs: this.options.timeoutMs ?? NOTIFICATIONS.WEBHOOK_TIMEOUT_MS,
        fetchImpl: this.options.fetchImpl,
        field: 'recipient.url',
      });

      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        const error = new ExternalServiceError('Webhook endpoint rejected the notification', {
          provider: 'webhook',
          status: response.status,
        });
        (error as ExternalServiceError & { retryable: boolean }).retryable = false;
        throw error;
      }

      if (!response.ok) {
        throw new ExternalServiceError('Webhook delivery failed', {
          provider: 'webhook',
          status: response.status,
        });
      }

      return { id: randomUUID(), status: response.status };
    } catch (error) {
      if (error instanceof ExternalServiceError || error instanceof ValidationError) {
        throw error;
      }
      throw new ExternalServiceError('Webhook delivery failed', { provider: 'webhook' });
    }
  }
}

export class WebhookChannelAdapter implements ChannelAdapter {
  readonly channel = 'webhook' as const;
  readonly ready = true;

  constructor(private readonly provider: WebhookProvider) {}

  async send(message: ChannelSendMessage): Promise<ChannelSendResult> {
    const url = message.recipient.url;
    if (!url) {
      throw new ValidationError('Webhook notifications require a URL', [
        { path: 'recipient.url', message: 'Provide recipient.url', code: 'custom' },
      ]);
    }

    const sent = await this.provider.send({
      url,
      payload: {
        id: message.deliveryId,
        channel: message.channel,
        category: message.category,
        priority: message.priority,
        title: message.rendered.title,
        body: message.rendered.body,
        data: message.data,
        metadata: message.metadata ?? {},
      },
    });

    return { provider: this.provider.name, providerMessageId: sent.id };
  }
}
