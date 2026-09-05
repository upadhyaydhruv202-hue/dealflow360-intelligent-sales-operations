import { JOBS } from '../../constants';
import { ExternalServiceError, ValidationError } from '../../errors';
import type { JobQueue } from '../../jobs/queue';
import { sanitizeErrorMessage } from '../../errors/sanitize';
import type { AuditService } from '../../audit/audit.service';
import { recordAiCall, type MetricsSink } from '../../observability';
import { parseAiOutput, parseWithSchema } from '../../schemas/parse';
import type { AppConfig } from '../../types/config';
import type { DependencyCheck } from '../../types/health';
import type { AppLogger } from '../../utils/logger';
import { getRequestId } from '../../utils/request-context';
import type { ZodType } from 'zod';
import { resolveAiRuntimeConfig, type AiRuntimeConfig } from './ai.config';
import { isRetryableStructuredOutputError, mapAiTransportError } from './ai.errors';
import { extractJson } from './ai.json';
import type { AiProvider } from './ai.provider';
import { applyConfidenceReview, applyDraftReview, applyExtractReview } from './ai.review';
import {
  aiAnalysisSchema,
  aiAnalyzeInputSchema,
  aiClassifyInputSchema,
  aiDecisionEnvelopeSchema,
  aiDraftInputSchema,
  aiDraftSchema,
  aiEmbedInputSchema,
  aiExtractInputSchema,
  aiGenerateTextInputSchema,
  aiRecommendInputSchema,
  aiRecommendationSchema,
  aiSummarizeInputSchema,
  aiSummarySchema,
  buildClassificationSchema,
  buildExtractSchema,
  resolveDocumentContent,
  resolveRecommendContext,
} from './ai.schemas';
import type {
  AiAnalysis,
  AiAnalyzeInput,
  AiClassification,
  AiClassifyInput,
  AiDraft,
  AiDraftInput,
  AiEmbedInput,
  AiEmbedResult,
  AiExtractInput,
  AiExtraction,
  AiFetch,
  AiGenerateStructuredInput,
  AiGenerateTextInput,
  AiMessage,
  AiOperation,
  AiProviderContent,
  AiProviderGenerateInput,
  AiProviderGenerateResult,
  AiRecommendInput,
  AiRecommendation,
  AiSleeper,
  AiStructuredResult,
  AiSummarizeInput,
  AiSummary,
  AiTextResult,
} from './ai.types';
import { AI_ANALYZE_JOB } from './ai.types';
import { createAiGuardrails, wrapUntrustedData, applyDecisionPolicy, type AiDecision, type AiGuardrails } from './guardrails';
import {
  ANALYZE_PROMPT,
  CLASSIFY_PROMPT,
  DRAFT_PROMPT,
  EXTRACT_PROMPT,
  RECOMMEND_PROMPT,
  SUMMARIZE_PROMPT,
} from './prompts';
import { createAiProvider } from './providers/create-provider';

export interface AIServiceOptions {
  config: AppConfig;
  logger: AppLogger;
  runtime?: AiRuntimeConfig;
  provider?: AiProvider;
  fetchImpl?: AiFetch;
  sleep?: AiSleeper;
  jobs?: JobQueue | null;
  audit?: AuditService | null;
  metrics?: MetricsSink | null;
  guardrails?: AiGuardrails;
}

export class AIService {
  readonly runtime: AiRuntimeConfig;
  readonly guardrails: AiGuardrails;
  private readonly providerInstance: AiProvider | null;
  private readonly logger: AppLogger;
  private readonly jobs: JobQueue | null;
  private readonly metrics: MetricsSink | null;

  constructor(options: AIServiceOptions) {
    this.runtime = options.runtime ?? resolveAiRuntimeConfig(options.config);
    this.logger = options.logger;
    this.jobs = options.jobs ?? null;
    this.metrics = options.metrics ?? null;
    this.guardrails =
      options.guardrails ??
      createAiGuardrails({
        maxInputChars: this.runtime.maxInputChars,
        timeoutMs: this.runtime.timeoutMs,
        maxRetries: this.runtime.maxRetries,
        parseRetries: this.runtime.parseRetries,
        audit: options.audit,
        logger: options.logger,
        provider: this.runtime.provider,
      });
    this.providerInstance =
      options.provider ??
      (this.runtime.ready
        ? createAiProvider({
            runtime: this.runtime,
            logger: options.logger,
            fetchImpl: options.fetchImpl,
            sleep: options.sleep,
          })
        : null);
  }

  get enabled(): boolean {
    return this.runtime.enabled;
  }

  get ready(): boolean {
    return this.runtime.ready && Boolean(this.providerInstance);
  }

  get provider(): AiProvider {
    return this.requireProvider();
  }

  registerJobs(): void {
    this.jobs?.process(AI_ANALYZE_JOB, async (payload) => {
      const parsed = parseWithSchema(aiAnalyzeInputSchema, payload, {
        source: 'job',
        message: 'Invalid AI analyze job payload',
      });
      await this.analyze(parsed);
    });
  }

  async enqueueAnalyze(input: AiAnalyzeInput, options: { jobId?: string } = {}): Promise<string> {
    if (!this.jobs) {
      throw new ExternalServiceError('Job queue is not configured', { provider: 'jobs' });
    }

    const parsed = parseWithSchema(aiAnalyzeInputSchema, input, {
      source: 'job',
      message: 'Invalid AI analyze job payload',
    });
    return this.jobs.enqueue(AI_ANALYZE_JOB, parsed, {
      attempts: JOBS.DEFAULT_ATTEMPTS,
      backoffMs: JOBS.DEFAULT_BACKOFF_MS,
      timeoutMs: JOBS.DEFAULT_TIMEOUT_MS,
      jobId: options.jobId,
    });
  }

  async ping(): Promise<void> {
    const check = await this.checkConnectivity();
    if (!check.healthy) {
      throw new ExternalServiceError(check.error ?? 'AI is unavailable', {
        provider: this.runtime.provider,
      });
    }
  }

  async checkConnectivity(): Promise<DependencyCheck> {
    if (!this.runtime.enabled) {
      return { configured: false, healthy: true, skipped: true };
    }

    if (!this.runtime.ready || !this.providerInstance) {
      return {
        configured: true,
        healthy: false,
        skipped: false,
        error: 'AI is enabled but the selected provider is not configured',
      };
    }

    const started = Date.now();

    try {
      await this.providerInstance.ping();
      return {
        configured: true,
        healthy: true,
        skipped: false,
        latencyMs: Date.now() - started,
      };
    } catch (error) {
      return {
        configured: true,
        healthy: false,
        skipped: false,
        latencyMs: Date.now() - started,
        error: sanitizeErrorMessage(error instanceof Error ? error.message : 'AI connectivity check failed'),
      };
    }
  }

  async generateText(input: AiGenerateTextInput): Promise<AiTextResult> {
    const parsed = parseWithSchema(aiGenerateTextInputSchema, input, {
      source: 'body',
      message: 'Invalid AI generation request',
    });

    const result = await this.execute('generateText', {
      operation: 'generateText',
      system: collectSystem(parsed),
      contents: wrapUserContents(toContents(parsed)),
      json: false,
      temperature: parsed.temperature,
      maxOutputTokens: parsed.maxOutputTokens,
      model: parsed.model,
    });

    return toTextResult(this.runtime.provider, result);
  }

  async generateStructured<T>(input: AiGenerateStructuredInput<T>): Promise<AiStructuredResult<T>> {
    const parsed = parseWithSchema(aiGenerateTextInputSchema, input, {
      source: 'body',
      message: 'Invalid AI structured generation request',
    });

    return this.executeStructured('generateStructured', input.schema, {
      operation: 'generateStructured',
      system: joinSystem(
        collectSystem(parsed),
        'Return JSON only. Do not wrap the response in markdown. Match the requested schema exactly.',
      ),
      contents: wrapUserContents(toContents(parsed)),
      json: true,
      temperature: parsed.temperature,
      maxOutputTokens: parsed.maxOutputTokens,
      model: parsed.model,
      metadata: { schemaName: input.schemaName },
    });
  }

  async generateDecision(input: AiGenerateTextInput): Promise<AiStructuredResult<AiDecision>> {
    const parsed = parseWithSchema(aiGenerateTextInputSchema, input, {
      source: 'body',
      message: 'Invalid AI decision request',
    });

    const result = await this.executeStructured('generateStructured', aiDecisionEnvelopeSchema, {
      operation: 'generateStructured',
      system: joinSystem(
        collectSystem(parsed),
        'Return a decision envelope as JSON only. Do not wrap the response in markdown.',
      ),
      contents: wrapUserContents(toContents(parsed)),
      json: true,
      temperature: parsed.temperature,
      maxOutputTokens: parsed.maxOutputTokens,
      model: parsed.model,
      metadata: { schemaName: 'decision' },
    });

    return {
      ...result,
      data: applyDecisionPolicy(result.data),
    };
  }

  async summarize(input: AiSummarizeInput): Promise<AiStructuredResult<AiSummary>> {
    const parsed = parseWithSchema(aiSummarizeInputSchema, input, {
      source: 'body',
      message: 'Invalid AI summarize request',
    });
    const prompt = SUMMARIZE_PROMPT.build({ ...parsed, content: resolveDocumentContent(parsed) });

    return this.executeStructured('summarize', aiSummarySchema, {
      operation: 'summarize',
      system: joinSystem(parsed.system, prompt.system),
      contents: [{ role: 'user', text: prompt.prompt }],
      json: true,
      temperature: parsed.temperature,
      maxOutputTokens: parsed.maxOutputTokens,
      model: parsed.model,
      metadata: { promptId: prompt.id, promptVersion: prompt.version },
    });
  }

  async classify(input: AiClassifyInput): Promise<AiStructuredResult<AiClassification>> {
    const parsed = parseWithSchema(aiClassifyInputSchema, input, {
      source: 'body',
      message: 'Invalid AI classify request',
    });
    const prompt = CLASSIFY_PROMPT.build({ ...parsed, content: resolveDocumentContent(parsed) });
    const schema = buildClassificationSchema(parsed.labels);

    return this.executeStructured('classify', schema, {
      operation: 'classify',
      system: joinSystem(parsed.system, prompt.system),
      contents: [{ role: 'user', text: prompt.prompt }],
      json: true,
      temperature: parsed.temperature,
      maxOutputTokens: parsed.maxOutputTokens,
      model: parsed.model,
      metadata: { labels: parsed.labels, promptId: prompt.id, promptVersion: prompt.version },
    });
  }

  async extract(input: AiExtractInput): Promise<AiStructuredResult<AiExtraction>> {
    const parsed = parseWithSchema(aiExtractInputSchema, input, {
      source: 'body',
      message: 'Invalid AI extract request',
    });
    const schemaName = parsed.schemaName ?? 'fields';
    const attachments = input.attachments;
    const prompt = EXTRACT_PROMPT.build({
      ...parsed,
      schemaName,
      content: resolveDocumentContent(parsed),
    });
    const schema = buildExtractSchema(schemaName, parsed.fields);

    const result = await this.executeStructured('extract', schema, {
      operation: 'extract',
      system: joinSystem(parsed.system, prompt.system),
      contents: [{ role: 'user', text: prompt.prompt }],
      json: true,
      temperature: parsed.temperature,
      maxOutputTokens: parsed.maxOutputTokens,
      model: parsed.model,
      attachments,
      metadata: {
        fields: parsed.fields,
        schemaName,
        promptId: prompt.id,
        promptVersion: prompt.version,
        attachmentCount: attachments?.length,
      },
    });

    return {
      ...result,
      data: applyExtractReview(
        result.data,
        schemaName === 'fields' ? parsed.fields : undefined,
      ) as AiExtraction,
    };
  }

  async analyze(input: AiAnalyzeInput): Promise<AiStructuredResult<AiAnalysis>> {
    const parsed = parseWithSchema(aiAnalyzeInputSchema, input, {
      source: 'body',
      message: 'Invalid AI analyze request',
    });
    const prompt = ANALYZE_PROMPT.build({ ...parsed, content: resolveDocumentContent(parsed) });

    const result = await this.executeStructured('analyze', aiAnalysisSchema, {
      operation: 'analyze',
      system: joinSystem(parsed.system, prompt.system),
      contents: [{ role: 'user', text: prompt.prompt }],
      json: true,
      temperature: parsed.temperature,
      maxOutputTokens: parsed.maxOutputTokens,
      model: parsed.model,
      metadata: { focus: parsed.focus, promptId: prompt.id, promptVersion: prompt.version },
    });

    return {
      ...result,
      data: applyConfidenceReview(result.data),
    };
  }

  async recommend(input: AiRecommendInput): Promise<AiStructuredResult<AiRecommendation>> {
    const parsed = parseWithSchema(aiRecommendInputSchema, input, {
      source: 'body',
      message: 'Invalid AI recommend request',
    });
    const prompt = RECOMMEND_PROMPT.build({ ...parsed, context: resolveRecommendContext(parsed) });

    return this.executeStructured('recommend', aiRecommendationSchema, {
      operation: 'recommend',
      system: joinSystem(parsed.system, prompt.system),
      contents: [{ role: 'user', text: prompt.prompt }],
      json: true,
      temperature: parsed.temperature,
      maxOutputTokens: parsed.maxOutputTokens,
      model: parsed.model,
      metadata: { promptId: prompt.id, promptVersion: prompt.version },
    });
  }

  async draft(input: AiDraftInput): Promise<AiStructuredResult<AiDraft>> {
    const parsed = parseWithSchema(aiDraftInputSchema, input, {
      source: 'body',
      message: 'Invalid AI draft request',
    });
    const prompt = DRAFT_PROMPT.build({ ...parsed, content: resolveDocumentContent(parsed) });

    const result = await this.executeStructured('draft', aiDraftSchema, {
      operation: 'draft',
      system: joinSystem(parsed.system, prompt.system),
      contents: [{ role: 'user', text: prompt.prompt }],
      json: true,
      temperature: parsed.temperature,
      maxOutputTokens: parsed.maxOutputTokens,
      model: parsed.model,
      metadata: { promptId: prompt.id, promptVersion: prompt.version },
    });

    return {
      ...result,
      data: applyDraftReview(result.data),
    };
  }

  async embed(input: AiEmbedInput): Promise<AiEmbedResult> {
    const parsed = parseWithSchema(aiEmbedInputSchema, input, {
      source: 'body',
      message: 'Invalid AI embed request',
    });
    const provider = this.requireProvider();
    const text = this.guardrails.prepareEmbedText(parsed.text);

    return this.observe('embed', text.length, () =>
      provider.embed({
        text,
        model: parsed.model,
      }),
      { model: parsed.model ?? this.runtime.embedModel },
    );
  }

  private async executeStructured<T>(
    operation: AiOperation,
    schema: ZodType<T>,
    input: AiProviderGenerateInput,
  ): Promise<AiStructuredResult<T>> {
    const maxAttempts = this.runtime.parseRetries + 1;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const nextInput =
        attempt === 1
          ? input
          : {
              ...input,
              system: joinSystem(
                input.system,
                'The previous response was invalid. Return valid JSON only. Do not wrap it in markdown.',
              ),
            };

      try {
        const result = await this.execute(operation, nextInput, attempt);
        const parsed = this.guardrails.applyOutputPolicy(parseAiOutput(schema, extractJson(result.text)));
        if (hasDecisionFields(parsed)) {
          await this.guardrails.auditDecision({
            operation,
            status: 'success',
            model: result.model,
            confidence: parsed.confidence,
            requiresReview: parsed.requiresReview,
          });
        }
        return {
          data: parsed,
          rawText: result.text,
          model: result.model,
          provider: this.runtime.provider,
          usage: result.usage,
        };
      } catch (error) {
        lastError = error;
        if (attempt < maxAttempts && isRetryableParseError(error)) {
          continue;
        }

        throw error;
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new ExternalServiceError('AI structured output failed', { provider: this.runtime.provider });
  }

  private async execute(
    operation: AiOperation,
    input: AiProviderGenerateInput,
    attempt = 1,
  ): Promise<AiProviderGenerateResult> {
    const provider = this.requireProvider();
    const prepared = this.guardrails.prepareProviderInput(input);
    return this.observe(operation, promptChars(prepared), () => provider.generateText(prepared), {
      attempt,
      model: prepared.model ?? this.runtime.model,
      promptId: prepared.metadata?.promptId,
      promptVersion: prepared.metadata?.promptVersion,
      attachmentCount: prepared.attachments?.length ?? 0,
      injectionSignals: prepared.metadata?.injectionSignals,
    });
  }

  private async observe<T>(
    operation: AiOperation,
    promptCharsCount: number,
    fn: () => Promise<T>,
    extra: Record<string, unknown> = {},
  ): Promise<T> {
    const started = Date.now();
    const requestId = getRequestId();
    const model = typeof extra.model === 'string' ? extra.model : this.runtime.model;

    try {
      const result = await fn();
      const latencyMs = Date.now() - started;
      this.logger.info(
        {
          module: 'ai',
          operation,
          provider: this.runtime.provider,
          model,
          latencyMs,
          success: true,
          requestId,
          promptChars: promptCharsCount,
          ...extra,
        },
        'AI request',
      );
      recordAiCall(this.metrics, {
        provider: this.runtime.provider,
        operation,
        latencyMs,
        success: true,
      });
      await this.guardrails.auditGeneration({
        operation,
        status: 'success',
        model,
        promptChars: promptCharsCount,
        attempt: typeof extra.attempt === 'number' ? extra.attempt : undefined,
      });
      return result;
    } catch (error) {
      const mapped = mapAiTransportError(error, this.runtime.provider);
      const latencyMs = Date.now() - started;
      this.logger.warn(
        {
          module: 'ai',
          operation,
          provider: this.runtime.provider,
          model,
          latencyMs,
          success: false,
          requestId,
          promptChars: promptCharsCount,
          error: mapped.message,
          ...extra,
        },
        'AI request',
      );
      recordAiCall(this.metrics, {
        provider: this.runtime.provider,
        operation,
        latencyMs,
        success: false,
      });
      await this.guardrails.auditGeneration({
        operation,
        status: 'failed',
        model,
        promptChars: promptCharsCount,
        attempt: typeof extra.attempt === 'number' ? extra.attempt : undefined,
      });
      throw mapped;
    }
  }

  private requireProvider(): AiProvider {
    if (!this.runtime.enabled) {
      throw new ExternalServiceError('AI integration is disabled', { provider: this.runtime.provider });
    }

    if (!this.providerInstance) {
      throw new ExternalServiceError('AI is not configured', { provider: this.runtime.provider });
    }

    return this.providerInstance;
  }
}

export function createAiService(options: AIServiceOptions): AIService {
  const service = new AIService(options);
  service.registerJobs();
  return service;
}

function toTextResult(provider: string, result: AiProviderGenerateResult): AiTextResult {
  return {
    text: result.text,
    model: result.model,
    provider,
    usage: result.usage,
  };
}

function collectSystem(input: { system?: string; messages?: AiMessage[] }): string | undefined {
  const fromMessages = input.messages?.filter((message) => message.role === 'system').map((message) => message.content);
  return joinSystem(input.system, ...(fromMessages ?? []));
}

function toContents(input: { prompt?: string; messages?: AiMessage[]; system?: string }): AiProviderContent[] {
  if (input.messages?.length) {
    const contents = input.messages
      .filter((message) => message.role !== 'system')
      .map((message) => ({
        role: (message.role === 'assistant' ? 'model' : 'user') as 'user' | 'model',
        text: message.content,
      }));

    if (contents.length === 0) {
      throw new ValidationError('Provide a user or assistant message', [
        { path: 'messages', message: 'At least one non-system message is required', code: 'custom' },
      ]);
    }

    return contents;
  }

  return [{ role: 'user', text: input.prompt ?? '' }];
}

function wrapUserContents(contents: AiProviderContent[]): AiProviderContent[] {
  return contents.map((content) =>
    content.role === 'user' ? { ...content, text: wrapUntrustedData('user', content.text) } : content,
  );
}

function joinSystem(...parts: Array<string | undefined>): string | undefined {
  const joined = parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join('\n');
  return joined.length > 0 ? joined : undefined;
}

function promptChars(input: AiProviderGenerateInput): number {
  const contentChars = input.contents.reduce((sum, content) => sum + content.text.length, 0);
  return contentChars + (input.system?.length ?? 0);
}

function isRetryableParseError(error: unknown): boolean {
  return isRetryableStructuredOutputError(error);
}

function hasDecisionFields(
  value: unknown,
): value is { confidence: number; requiresReview: boolean } {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  return typeof record.confidence === 'number' && typeof record.requiresReview === 'boolean';
}
