import { JOBS } from '../../constants';
import { ExternalServiceError } from '../../errors';
import type { AIService } from '../ai';
import type { JobQueue } from '../../jobs/queue';
import { IdempotencyStore } from '../../lib/idempotency';
import { MemoryKvStore } from '../../lib/kv';
import { parseWithSchema } from '../../schemas/parse';
import { isDemoMode, shouldMockExternalIntegrations } from '../../features';
import type { AppConfig } from '../../types/config';
import type { AppLogger } from '../../utils/logger';
import {
  fallbackGeneratedEmail,
  buildEmailContentPrompt,
  mergeGeneratedEmail,
  parseGenerateEmailContentInput,
  parseGeneratedEmailModel,
  splitVerifiedFacts,
  type GenerateEmailContentInput,
  type GeneratedEmailContent,
} from './email.generate';
import { emailSendJobPayloadSchema, generatedEmailContentSchema, sendEmailInputSchema } from './email.schemas';
import {
  EMAIL_SEND_JOB,
  type EmailProvider,
  type EmailProviderName,
  type ResolvedSendEmailInput,
  type SendEmailInput,
  type SentEmail,
} from './email.types';
import { toRecipientList } from './email.util';
import { BrevoEmailProvider } from './providers/brevo.provider';
import { MockEmailProvider } from './providers/mock.provider';
import { ResendEmailProvider } from './providers/resend.provider';
import { SmtpEmailProvider } from './providers/smtp.provider';
import { renderEmailTemplate } from './templates';

export interface EmailServiceOptions {
  config: AppConfig;
  logger: AppLogger;
  jobs?: JobQueue | null;
  provider?: EmailProvider;
  idempotency?: IdempotencyStore | null;
  ai?: AIService | null;
  fetchImpl?: typeof fetch;
}

export class EmailService {
  readonly providerName: EmailProviderName;
  private readonly provider: EmailProvider;
  private readonly jobs: JobQueue | null;
  private readonly enabled: boolean;
  private readonly idempotency: IdempotencyStore;
  private readonly appName: string;
  private readonly ai: AIService | null;

  constructor(options: EmailServiceOptions) {
    this.provider = options.provider ?? createEmailProvider(options.config, options.fetchImpl);
    this.providerName = this.provider.name;
    this.jobs = options.jobs ?? null;
    this.enabled = options.config.email.enabled || isDemoMode(options.config);
    this.idempotency = options.idempotency ?? new IdempotencyStore(new MemoryKvStore());
    this.appName = options.config.app.name;
    this.ai = options.ai ?? null;
  }

  get ready(): boolean {
    return this.enabled;
  }

  registerJobs(): void {
    this.jobs?.process(EMAIL_SEND_JOB, async (payload) => {
      const job = parseWithSchema(emailSendJobPayloadSchema, payload, {
        source: 'job',
        message: 'Invalid email job payload',
      });
      await this.deliver(job);
    });
  }

  async sendEmail(
    input: SendEmailInput,
    options: { async?: boolean } = {},
  ): Promise<SentEmail | { queued: true; jobId: string }> {
    return this.send(input, options);
  }

  async send(
    input: SendEmailInput,
    options: { async?: boolean } = {},
  ): Promise<SentEmail | { queued: true; jobId: string }> {
    const parsed = parseWithSchema(sendEmailInputSchema, input, { source: 'body', message: 'Invalid email' });
    if (!this.enabled) {
      throw new ExternalServiceError('Email is not configured', { provider: 'email' });
    }

    if (options.async && this.jobs) {
      const jobId = await this.jobs.enqueue(EMAIL_SEND_JOB, parsed, {
        attempts: JOBS.DEFAULT_ATTEMPTS,
        backoffMs: JOBS.DEFAULT_BACKOFF_MS,
        timeoutMs: JOBS.DEFAULT_TIMEOUT_MS,
        jobId: parsed.idempotencyKey ? `email.send:${parsed.idempotencyKey}` : undefined,
      });
      return { queued: true as const, jobId };
    }

    return this.deliver(parsed);
  }

  async deliver(input: SendEmailInput): Promise<SentEmail> {
    const resolved = this.resolveInput(input);

    if (resolved.idempotencyKey) {
      if (await this.idempotency.isCompleted(resolved.idempotencyKey)) {
        return skippedEmail(resolved, this.providerName);
      }
      const acquired = await this.idempotency.begin(resolved.idempotencyKey);
      if (!acquired) {
        return skippedEmail(resolved, this.providerName);
      }
    }

    try {
      const sent = await this.provider.send(resolved);
      if (resolved.idempotencyKey) {
        await this.idempotency.complete(resolved.idempotencyKey);
      }
      return sent;
    } catch (error) {
      if (resolved.idempotencyKey) {
        await this.idempotency.release(resolved.idempotencyKey);
      }
      throw error;
    }
  }

  async generateEmailContent(input: GenerateEmailContentInput): Promise<GeneratedEmailContent> {
    const parsed = parseGenerateEmailContentInput(input);
    const { publicFacts, secretFacts } = splitVerifiedFacts(parsed.verifiedFacts);

    if (!this.ai?.enabled) {
      return fallbackGeneratedEmail(parsed);
    }

    const prompt = buildEmailContentPrompt(parsed, publicFacts);
    const result = await this.ai.generateStructured({
      prompt: prompt.prompt,
      system: prompt.system,
      schema: generatedEmailContentSchema,
      schemaName: 'emailContent',
    });
    const drafted = parseGeneratedEmailModel(result.data);

    return mergeGeneratedEmail({
      subject: drafted.subject,
      preview: drafted.preview,
      body: drafted.body,
      warnings: drafted.warnings,
      confidence: drafted.confidence,
      facts: { ...publicFacts, ...secretFacts },
      publicFacts,
      source: 'ai',
    });
  }

  private resolveInput(input: SendEmailInput): ResolvedSendEmailInput {
    const variables = { appName: this.appName, ...input.variables };
    if (input.template) {
      const rendered = renderEmailTemplate(input.template, variables);
      return {
        to: input.to,
        subject: input.subject?.trim() || rendered.subject,
        text: input.text?.trim() || rendered.text,
        html: input.html ?? rendered.html,
        attachments: input.attachments,
        replyTo: input.replyTo,
        idempotencyKey: input.idempotencyKey,
        template: input.template,
      };
    }

    return {
      to: input.to,
      subject: input.subject ?? '',
      text: input.text ?? '',
      html: input.html,
      attachments: input.attachments,
      replyTo: input.replyTo,
      idempotencyKey: input.idempotencyKey,
    };
  }
}

export function createEmailService(options: EmailServiceOptions): EmailService {
  const service = new EmailService(options);
  service.registerJobs();
  return service;
}

export function createEmailProvider(config: AppConfig, fetchImpl?: typeof fetch): EmailProvider {
  if (shouldMockExternalIntegrations(config) || !config.email.enabled || config.email.provider === 'mock') {
    return new MockEmailProvider();
  }

  const from = config.email.from;
  switch (config.email.provider) {
    case 'resend':
      return new ResendEmailProvider({
        apiKey: config.email.resend.apiKey ?? '',
        from: from ?? '',
        timeoutMs: config.email.timeoutMs,
        fetchImpl,
      });
    case 'brevo':
      return new BrevoEmailProvider({
        apiKey: config.email.brevo.apiKey ?? '',
        from: from ?? '',
        timeoutMs: config.email.timeoutMs,
        fetchImpl,
      });
    default:
      return new SmtpEmailProvider(config.email.smtp);
  }
}

function skippedEmail(input: ResolvedSendEmailInput, provider: EmailProviderName): SentEmail {
  return {
    id: input.idempotencyKey ?? 'duplicate',
    to: toRecipientList(input.to),
    subject: input.subject,
    provider,
  };
}
