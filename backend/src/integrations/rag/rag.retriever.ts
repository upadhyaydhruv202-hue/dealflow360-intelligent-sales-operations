import { parseWithSchema } from '../../schemas/parse';
import { ragRetrieveOptionsSchema } from './rag.schemas';
import type { EmbeddingProvider, RetrievedChunk, Retriever, RetrieveOptions, VectorStore } from './rag.types';

export interface SimilarityRetrieverOptions {
  embeddings: EmbeddingProvider;
  store: VectorStore;
  defaultTopK: number;
  defaultMinScore: number;
}

export class SimilarityRetriever implements Retriever {
  constructor(private readonly options: SimilarityRetrieverOptions) {}

  async retrieve(query: string, options: RetrieveOptions = {}): Promise<RetrievedChunk[]> {
    const parsed = parseWithSchema(
      ragRetrieveOptionsSchema,
      {
        query,
        topK: options.topK ?? this.options.defaultTopK,
        minScore: options.minScore ?? this.options.defaultMinScore,
        documentIds: options.documentIds,
      },
      { source: 'body', message: 'Invalid RAG retrieval request' },
    );

    const embedding = await this.options.embeddings.embed(parsed.query);
    const hits = await this.options.store.query(embedding, {
      topK: parsed.topK,
      documentIds: parsed.documentIds,
      createdBy: options.createdBy,
      minScore: parsed.minScore,
    });

    return hits.map((hit) => ({
      documentId: hit.documentId,
      chunkId: hit.chunkId,
      source: hit.source,
      content: hit.content,
      metadata: hit.metadata,
      score: hit.score,
    }));
  }
}

export function createRetriever(options: SimilarityRetrieverOptions): SimilarityRetriever {
  return new SimilarityRetriever(options);
}
