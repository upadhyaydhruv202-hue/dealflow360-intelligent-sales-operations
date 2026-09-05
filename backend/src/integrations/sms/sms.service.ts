import { JOBS } from '../../constants';
import { ExternalServiceError } from '../../errors';
import type { JobQueue } from '../../jobs/queue';
import { IdempotencyStore } from '../../lib/idempotency';
import { MemoryKvStore } from '../../lib/kv';
import { parseWithSchema } from '../../schemas/parse';
import { isDemoMode, shouldMockExternalIntegrations } from '../../features';
import type { AppConfig } from '../../types/config';
import { sendSmsInputSchema, smsSendJobPayloadSchema } from './sms.schemas';
import { SMS_SEND_JOB, type SendSmsInput, type SentSms, type SmsProvider } from './sms.types';
import { createHttpSmsProvider } from './providers/http.provider';
import { MockSmsProvider } from './providers/mock.provider';

export interface SmsServiceOptions {
  config: AppConfig;
  jobs?: JobQueue | null;
  provider?: SmsProvider;
  idempotency?: IdempotencyStore | null;
  fetchImpl?: typeof fetch;
}

export class SmsService {
  readonly providerName: 'mock' | 'http';
  private readonly provider: SmsProvider;
  private readonly jobs: JobQueue | null;
  private readonly enabled: boolean;
  private readonly idempotency: IdempotencyStore;

  constructor(options: SmsServiceOptions) {
    this.provider = options.provider ?? createSmsProvider(options.config, options.fetchImpl);
    this.providerName = this.provider.name;
    this.jobs = options.jobs ?? null;
    this.enabled = options.config.sms.enabled || isDemoMode(options.config);
    this.idempotency = options.idempotency ?? new IdempotencyStore(new MemoryKvStore());
  }

  get ready(): boolean {
    return this.enabled;
  }

  registerJobs(): void {
    this.jobs?.process(SMS_SEND_JOB, async (payload) => {
      const job = parseWithSchema(smsSendJobPayloadSchema, payload, {
        source: 'job',
        message: 'Invalid SMS job payload',
      });
      await this.deliver(job);
    });
  }

  async send(input: SendSmsInput, options: { async?: boolean } = {}): Promise<SentSms | { queued: true; jobId: string }> {
    const parsed = parseWithSchema(sendSmsInputSchema, input, { source: 'body', message: 'Invalid SMS' });
    if (!this.enabled) {
      throw new ExternalServiceError('SMS is not configured', { provider: 'sms' });
    }

    if (options.async && this.jobs) {
      const jobId = await this.jobs.enqueue(SMS_SEND_JOB, parsed, {
        attempts: JOBS.DEFAULT_ATTEMPTS,
        backoffMs: JOBS.DEFAULT_BACKOFF_MS,
        timeoutMs: JOBS.DEFAULT_TIMEOUT_MS,
        jobId: parsed.idempotencyKey ? `sms.send:${parsed.idempotencyKey}` : undefined,
      });
      return { queued: true as const, jobId };
    }

    return this.deliver(parsed);
  }

  async deliver(input: SendSmsInput): Promise<SentSms> {
    if (!this.enabled) {
      throw new ExternalServiceError('SMS is not configured', { provider: 'sms' });
    }

    if (input.idempotencyKey) {
      if (await this.idempotency.isCompleted(input.idempotencyKey)) {
        return skippedSms(input, this.providerName);
      }
      const acquired = await this.idempotency.begin(input.idempotencyKey);
      if (!acquired) {
        return skippedSms(input, this.providerName);
      }
    }

    try {
      const sent = await this.provider.send(input);
      if (input.idempotencyKey) {
        await this.idempotency.complete(input.idempotencyKey);
      }
      return sent;
    } catch (error) {
      if (input.idempotencyKey) {
        await this.idempotency.release(input.idempotencyKey);
      }
      throw error;
    }
  }
}

export function createSmsService(options: SmsServiceOptions): SmsService {
  const service = new SmsService(options);
  service.registerJobs();
  return service;
}

export function createSmsProvider(config: AppConfig, fetchImpl?: typeof fetch): SmsProvider {
  if (shouldMockExternalIntegrations(config) || !config.sms.enabled || config.sms.provider === 'mock') {
    return new MockSmsProvider();
  }

  return createHttpSmsProvider(config, fetchImpl);
}

function skippedSms(input: SendSmsInput, provider: 'mock' | 'http'): SentSms {
  return {
    id: input.idempotencyKey ?? 'duplicate',
    to: input.to,
    provider,
  };
}
