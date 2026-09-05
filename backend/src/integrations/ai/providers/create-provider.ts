import { ExternalServiceError } from '../../../errors';
import type { AppLogger } from '../../../utils/logger';
import type { AiRuntimeConfig } from '../ai.config';
import type { AiProvider } from '../ai.provider';
import type { AiFetch, AiSleeper } from '../ai.types';
import { GeminiAiProvider } from './gemini.provider';
import { MockAiProvider } from './mock.provider';

export interface CreateAiProviderOptions {
  runtime: AiRuntimeConfig;
  logger: AppLogger;
  fetchImpl?: AiFetch;
  sleep?: AiSleeper;
}

export function createAiProvider(options: CreateAiProviderOptions): AiProvider {
  switch (options.runtime.provider) {
    case 'mock':
      return new MockAiProvider({ model: options.runtime.model });
    case 'gemini':
      return new GeminiAiProvider({
        config: options.runtime,
        logger: options.logger,
        fetchImpl: options.fetchImpl,
        sleep: options.sleep,
      });
    default: {
      const exhaustive: never = options.runtime.provider;
      throw new ExternalServiceError('Unknown AI provider', { provider: String(exhaustive) });
    }
  }
}
