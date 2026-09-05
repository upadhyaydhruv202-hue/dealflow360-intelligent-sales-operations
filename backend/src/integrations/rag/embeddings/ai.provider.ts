import type { AIService } from '../../ai';
import type { EmbeddingProvider } from '../rag.types';

export class AiEmbeddingProvider implements EmbeddingProvider {
  readonly name: string;
  readonly dimensions: number;
  private readonly ai: AIService;

  constructor(ai: AIService, dimensions = 0) {
    this.ai = ai;
    this.name = `ai:${ai.runtime.provider}`;
    this.dimensions = dimensions;
  }

  async embed(text: string): Promise<number[]> {
    const result = await this.ai.embed({ text });
    return result.embedding;
  }
}
