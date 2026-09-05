import { ExternalServiceError } from '../../../errors';
import type { AppLogger } from '../../../utils/logger';
import { getRequestId } from '../../../utils/request-context';
import type { AiRuntimeConfig } from '../ai.config';
import {
  isRetryableAiError,
  mapAiHttpError,
  mapAiTransportError,
  parseRetryAfterMs,
} from '../ai.errors';
import type { AiProvider } from '../ai.provider';
import type { AiEmbedInput, AiEmbedResult, AiFetch, AiProviderGenerateInput, AiProviderGenerateResult, AiSleeper } from '../ai.types';

interface GeminiGenerateResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
  error?: { message?: string; status?: string };
}

interface GeminiEmbedResponse {
  embedding?: { values?: number[] };
}

export interface GeminiAiProviderOptions {
  config: AiRuntimeConfig;
  logger: AppLogger;
  fetchImpl?: AiFetch;
  sleep?: AiSleeper;
}

export class GeminiAiProvider implements AiProvider {
  readonly name = 'gemini';
  private readonly fetchImpl: AiFetch;
  private readonly sleep: AiSleeper;

  constructor(private readonly options: GeminiAiProviderOptions) {
    this.fetchImpl = options.fetchImpl ?? defaultFetch;
    this.sleep = options.sleep ?? defaultSleep;
  }

  async ping(): Promise<void> {
    await this.request<unknown>(this.modelUrl(this.options.config.model), {
      method: 'GET',
      operation: 'ping',
    });
  }

  async generateText(input: AiProviderGenerateInput): Promise<AiProviderGenerateResult> {
    const model = input.model ?? this.options.config.model;
    const payload = this.buildBody(input);
    const response = await this.request<GeminiGenerateResponse>(`${this.modelUrl(model)}:generateContent`, {
      method: 'POST',
      body: JSON.stringify(payload),
      operation: input.operation,
      model,
    });

    const candidate = response.candidates?.[0];
    const text = (candidate?.content?.parts ?? [])
      .map((part) => part.text ?? '')
      .join('')
      .trim();
    const finishReason = candidate?.finishReason;

    if (!text) {
      if (finishReason === 'SAFETY' || finishReason === 'BLOCKLIST' || finishReason === 'PROHIBITED_CONTENT') {
        throw new ExternalServiceError('AI refused to generate a response', {
          provider: this.name,
          finishReason,
        });
      }

      throw new ExternalServiceError('AI returned an empty response', {
        provider: this.name,
        finishReason,
      });
    }

    return {
      text,
      model,
      finishReason,
      usage: {
        promptTokens: response.usageMetadata?.promptTokenCount,
        completionTokens: response.usageMetadata?.candidatesTokenCount,
        totalTokens: response.usageMetadata?.totalTokenCount,
      },
    };
  }

  async embed(input: AiEmbedInput): Promise<AiEmbedResult> {
    const model = input.model ?? this.options.config.embedModel;
    const response = await this.request<GeminiEmbedResponse>(`${this.modelUrl(model)}:embedContent`, {
      method: 'POST',
      body: JSON.stringify({
        content: { parts: [{ text: input.text }] },
      }),
      operation: 'embed',
      model,
    });

    const embedding = response.embedding?.values;
    if (!Array.isArray(embedding) || embedding.length === 0 || !embedding.every((value) => typeof value === 'number')) {
      throw new ExternalServiceError('AI returned an invalid embedding', { provider: this.name });
    }

    return {
      embedding,
      model,
      provider: this.name,
    };
  }

  private buildBody(input: AiProviderGenerateInput): Record<string, unknown> {
    const temperature = input.temperature ?? this.options.config.temperature;
    const maxOutputTokens = input.maxOutputTokens ?? this.options.config.maxOutputTokens;
    const contents = input.contents.map((content, index) => {
      const parts: Array<Record<string, unknown>> = [{ text: content.text }];
      const isLastUser = index === input.contents.length - 1 && content.role === 'user';
      if (isLastUser && input.attachments?.length) {
        for (const attachment of input.attachments) {
          parts.push({
            inlineData: {
              mimeType: attachment.mimeType,
              data: attachment.data.toString('base64'),
            },
          });
        }
      }

      return {
        role: content.role,
        parts,
      };
    });

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature,
        maxOutputTokens,
        ...(input.json ? { responseMimeType: 'application/json' } : {}),
      },
    };

    if (input.system) {
      body.systemInstruction = { parts: [{ text: input.system }] };
    }

    return body;
  }

  private async request<T>(
    url: string,
    init: { method: 'GET' | 'POST'; body?: string; operation: string; model?: string },
  ): Promise<T> {
    const maxAttempts = this.options.config.maxRetries + 1;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const started = Date.now();
      const requestId = getRequestId();

      try {
        const response = await this.fetchImpl(url, {
          method: init.method,
          headers: this.headers(),
          body: init.body,
          signal: AbortSignal.timeout(this.options.config.timeoutMs),
        });

        const payload = await readJsonPayload(response);
        const durationMs = Date.now() - started;

        if (!response.ok) {
          const retryAfterMs = parseRetryAfterMs(response.headers.get('retry-after'));
          const mapped = mapAiHttpError(response.status, payload, retryAfterMs, this.name);
          this.log('warn', {
            operation: init.operation,
            model: init.model,
            status: response.status,
            durationMs,
            attempt,
            requestId,
            success: false,
          });

          if (attempt < maxAttempts && isRetryableAiError(mapped)) {
            lastError = mapped;
            await this.sleep(retryAfterMs ?? backoffMs(this.options.config.retryBaseMs, attempt));
            continue;
          }

          throw mapped;
        }

        this.log('debug', {
          operation: init.operation,
          model: init.model,
          status: response.status,
          durationMs,
          attempt,
          requestId,
          success: true,
        });

        return payload as T;
      } catch (error) {
        if (isAppError(error)) {
          if (attempt < maxAttempts && isRetryableAiError(error)) {
            lastError = error;
            await this.sleep(backoffMs(this.options.config.retryBaseMs, attempt));
            continue;
          }

          throw error;
        }

        const mapped = mapAiTransportError(error, this.name);
        this.log('warn', {
          operation: init.operation,
          model: init.model,
          durationMs: Date.now() - started,
          attempt,
          requestId,
          success: false,
          error: mapped.message,
        });

        lastError = mapped;
        if (attempt < maxAttempts && isRetryableAiError(mapped)) {
          await this.sleep(backoffMs(this.options.config.retryBaseMs, attempt));
          continue;
        }

        throw mapped;
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new ExternalServiceError('AI request failed', { provider: this.name });
  }

  private headers(): Record<string, string> {
    const apiKey = this.options.config.apiKey;
    if (!apiKey) {
      throw new ExternalServiceError('Gemini API key is not configured', { provider: this.name });
    }

    return {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': this.options.config.userAgent,
      'x-goog-api-key': apiKey,
    };
  }

  private modelUrl(model: string): string {
    const encoded = encodeURIComponent(model);
    return `${this.options.config.geminiBaseUrl.replace(/\/+$/, '')}/models/${encoded}`;
  }

  private log(level: 'debug' | 'warn', payload: Record<string, unknown>): void {
    this.options.logger[level](
      {
        provider: this.name,
        ...payload,
      },
      'AI provider request',
    );
  }
}

async function readJsonPayload(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ExternalServiceError('AI provider returned a non-JSON response', {
      provider: 'gemini',
      status: response.status,
    });
  }
}

function backoffMs(baseMs: number, attempt: number): number {
  return baseMs * 2 ** (attempt - 1);
}

function defaultFetch(input: string, init: RequestInit): Promise<Response> {
  return fetch(input, init);
}

function defaultSleep(ms: number): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isAppError(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'statusCode' in error && 'code' in error);
}
