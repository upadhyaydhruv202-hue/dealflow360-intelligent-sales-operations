import { isFeatureEnabled } from '../../features';
import type { AppConfig } from '../../types/config';
import type { RagVectorStoreName } from './rag.types';

export interface RagRuntimeConfig {
  enabled: boolean;
  vectorStore: RagVectorStoreName;
  chunkSize: number;
  chunkOverlap: number;
  topK: number;
  minScore: number;
  maxContextChars: number;
  maxDocumentChars: number;
  maxChunksPerDocument: number;
  asyncThresholdChars: number;
}

export function isRagEnabled(config: Pick<AppConfig, 'features'>): boolean {
  return isFeatureEnabled(config, 'rag');
}

export function resolveRagRuntimeConfig(config: AppConfig): RagRuntimeConfig {
  const enabled = isRagEnabled(config);
  const requested = config.rag.vectorStore;
  const vectorStore: RagVectorStoreName =
    requested === 'postgres' || requested === 'memory'
      ? requested
      : resolveDefaultVectorStore(config);

  return {
    enabled,
    vectorStore,
    chunkSize: config.rag.chunkSize,
    chunkOverlap: config.rag.chunkOverlap,
    topK: config.rag.topK,
    minScore: config.rag.minScore,
    maxContextChars: config.rag.maxContextChars,
    maxDocumentChars: config.rag.maxDocumentChars,
    maxChunksPerDocument: config.rag.maxChunksPerDocument,
    asyncThresholdChars: config.rag.asyncThresholdChars,
  };
}

export function resolveDefaultVectorStore(
  config: Pick<AppConfig, 'databaseUrl'>,
): RagVectorStoreName {
  return config.databaseUrl ? 'postgres' : 'memory';
}
