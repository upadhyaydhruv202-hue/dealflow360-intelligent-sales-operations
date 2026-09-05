import { randomUUID } from 'node:crypto';

import { ExternalServiceError } from '../../../errors';
import { assertHttpUrl } from '../../../security';
import type { AppConfig } from '../../../types/config';
import type { SendSmsInput, SentSms, SmsProvider } from '../sms.types';

export class HttpSmsProvider implements SmsProvider {
  readonly name = 'http';

  constructor(
    private readonly options: {
      url: string;
      apiKey: string;
      from?: string;
      timeoutMs: number;
      fetchImpl?: typeof fetch;
    },
  ) {}

  async send(input: SendSmsInput): Promise<SentSms> {
    const fetchImpl = this.options.fetchImpl ?? fetch;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.options.timeoutMs);

    try {
      const response = await fetchImpl(this.options.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.options.apiKey}`,
        },
        body: JSON.stringify({
          to: input.to,
          from: this.options.from,
          text: input.text,
        }),
        redirect: 'error',
        signal: controller.signal,
      });

      if (response.status >= 400 && response.status < 500) {
        const error = new ExternalServiceError('SMS provider rejected the message', {
          provider: 'sms',
          status: response.status,
        });
        (error as ExternalServiceError & { retryable: boolean }).retryable = false;
        throw error;
      }

      if (!response.ok) {
        throw new ExternalServiceError('SMS delivery failed', {
          provider: 'sms',
          status: response.status,
        });
      }

      const body = (await response.json().catch(() => ({}))) as { id?: unknown };
      return {
        id: typeof body.id === 'string' && body.id ? body.id : randomUUID(),
        to: input.to,
        provider: 'http',
      };
    } catch (error) {
      if (error instanceof ExternalServiceError) {
        throw error;
      }
      throw new ExternalServiceError('SMS delivery failed', { provider: 'sms' });
    } finally {
      clearTimeout(timer);
    }
  }
}

export function createHttpSmsProvider(config: AppConfig, fetchImpl?: typeof fetch): HttpSmsProvider {
  if (!config.sms.httpUrl || !config.sms.apiKey) {
    throw new ExternalServiceError('HTTP SMS provider is not configured', { provider: 'sms' });
  }

  return new HttpSmsProvider({
    url: assertHttpUrl(config.sms.httpUrl, 'sms.httpUrl').href,
    apiKey: config.sms.apiKey,
    from: config.sms.from,
    timeoutMs: config.sms.timeoutMs,
    fetchImpl,
  });
}
