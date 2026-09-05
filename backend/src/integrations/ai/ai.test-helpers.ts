import pino from 'pino';

import { loadConfig } from '../../config';
import type { AppConfig } from '../../types/config';
import { AI_DEFAULTS, type AiRuntimeConfig } from './ai.config';
import { AIService } from './ai.service';
import type { AiFetch } from './ai.types';
import { MockAiProvider } from './providers/mock.provider';

export const silentLogger = pino({ level: 'silent' });

export function aiTestConfig(overrides: Record<string, string> = {}): AppConfig {
  return loadConfig({
    NODE_ENV: 'test',
    AI_ENABLED: 'true',
    AI_PROVIDER: 'mock',
    DEMO_MODE: 'true',
    ...overrides,
  });
}

export function aiRuntime(overrides: Partial<AiRuntimeConfig> = {}): AiRuntimeConfig {
  const provider = overrides.provider ?? 'mock';
  const embedModel =
    overrides.embedModel ??
    (provider === 'gemini' ? AI_DEFAULTS.geminiEmbedModel : AI_DEFAULTS.mockModel);
  const { provider: _provider, embedModel: _embedModel, ...rest } = overrides;

  return {
    enabled: true,
    ready: true,
    requestedProvider: provider,
    model: provider === 'gemini' ? AI_DEFAULTS.geminiModel : AI_DEFAULTS.mockModel,
    timeoutMs: 250,
    maxRetries: 2,
    retryBaseMs: 0,
    parseRetries: 1,
    maxOutputTokens: 256,
    temperature: 0.2,
    maxInputChars: 100_000,
    userAgent: 'hackathon-starter-kit-test',
    geminiBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    ...rest,
    provider,
    embedModel,
  };
}

export function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  });
}

export function geminiTextResponse(text: string, finishReason = 'STOP'): unknown {
  return {
    candidates: [
      {
        content: { parts: [{ text }], role: 'model' },
        finishReason,
      },
    ],
    usageMetadata: {
      promptTokenCount: 8,
      candidatesTokenCount: 4,
      totalTokenCount: 12,
    },
  };
}

export function createTestService(options: {
  provider?: MockAiProvider;
  runtime?: Partial<AiRuntimeConfig>;
  fetchImpl?: AiFetch;
  audit?: import('../../audit/audit.service').AuditService | null;
} = {}): { service: AIService; provider: MockAiProvider } {
  const provider = options.provider ?? new MockAiProvider();
  const runtime = aiRuntime(options.runtime);
  const service = new AIService({
    config: aiTestConfig(),
    logger: silentLogger,
    runtime,
    provider: runtime.provider === 'gemini' && options.fetchImpl ? undefined : provider,
    fetchImpl: options.fetchImpl,
    sleep: async () => undefined,
    audit: options.audit,
  });

  return { service, provider };
}
