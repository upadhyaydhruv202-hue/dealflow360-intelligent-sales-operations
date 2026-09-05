import type { AiEmbedInput, AiEmbedResult, AiProviderGenerateInput, AiProviderGenerateResult } from './ai.types';

export interface AiProvider {
  readonly name: string;
  generateText(input: AiProviderGenerateInput): Promise<AiProviderGenerateResult>;
  ping(): Promise<void>;
  embed(input: AiEmbedInput): Promise<AiEmbedResult>;
}
