import { AI_GUARDRAILS } from '../../constants';
import { isDemoMode, isFeatureEnabled } from '../../features';
import type { AppConfig } from '../../types/config';
import type { AiProviderName } from './ai.types';

export const AI_DEFAULTS = {
  geminiModel: 'gemini-2.5-flash',
  mockModel: 'mock',
  timeoutMs: 30_000,
  maxRetries: 2,
  retryBaseMs: 200,
  parseRetries: 1,
  maxOutputTokens: 4096,
  temperature: 0.2,
  maxInputChars: AI_GUARDRAILS.MAX_INPUT_CHARS,
  userAgent: 'hackathon-starter-kit/0.1.0',
  geminiBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
  geminiEmbedModel: 'gemini-embedding-001',
} as const;

export interface AiRuntimeConfig {
  enabled: boolean;
  ready: boolean;
  provider: AiProviderName;
  requestedProvider: AiProviderName;
  model: string;
  apiKey?: string;
  timeoutMs: number;
  maxRetries: number;
  retryBaseMs: number;
  parseRetries: number;
  maxOutputTokens: number;
  temperature: number;
  maxInputChars: number;
  userAgent: string;
  geminiBaseUrl: string;
  embedModel: string;
}

export function isAiEnabled(config: Pick<AppConfig, 'ai' | 'features'>): boolean {
  return isFeatureEnabled(config, 'ai');
}

export function resolveAiRuntimeConfig(config: AppConfig): AiRuntimeConfig {
  const enabled = isAiEnabled(config);
  const requestedProvider = config.ai.provider;
  const apiKey = config.ai.geminiApiKey;
  const provider = selectProvider(requestedProvider, {
    enabled,
    apiKey,
    demoMode: isDemoMode(config),
    isTest: config.isTest,
  });
  const ready = enabled && (provider === 'mock' || Boolean(apiKey));
  const model =
    config.ai.model ?? (provider === 'gemini' ? AI_DEFAULTS.geminiModel : AI_DEFAULTS.mockModel);
  const embedModel = provider === 'gemini' ? AI_DEFAULTS.geminiEmbedModel : AI_DEFAULTS.mockModel;

  return {
    enabled,
    ready,
    provider,
    requestedProvider,
    model,
    embedModel,
    apiKey,
    timeoutMs: config.ai.timeoutMs,
    maxRetries: config.ai.maxRetries,
    retryBaseMs: config.ai.retryBaseMs,
    parseRetries: AI_DEFAULTS.parseRetries,
    maxOutputTokens: config.ai.maxOutputTokens,
    temperature: config.ai.temperature,
    maxInputChars: AI_DEFAULTS.maxInputChars,
    userAgent: AI_DEFAULTS.userAgent,
    geminiBaseUrl: AI_DEFAULTS.geminiBaseUrl,
  };
}

function selectProvider(
  requested: AiProviderName,
  options: {
    enabled: boolean;
    apiKey?: string;
    demoMode: boolean;
    isTest: boolean;
  },
): AiProviderName {
  if (requested === 'mock') {
    return 'mock';
  }

  if (options.enabled && !options.apiKey && (options.demoMode || options.isTest)) {
    return 'mock';
  }

  return requested;
}
