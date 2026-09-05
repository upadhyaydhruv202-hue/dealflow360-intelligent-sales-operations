import { RAG } from '../../../constants';
import { cosineSimilarity } from '../rag.similarity';
import type { IndexedDocumentMeta, VectorQueryOptions, VectorStore } from '../rag.types';
import { RagRepository, toStoredChunk } from '../../../repositories/rag.repository';

export class PostgresVectorStore implements VectorStore {
  constructor(
    private readonly documents: RagRepository,
    private readonly maxScan = RAG.MAX_SCAN_CHUNKS,
  ) {}

  async upsertDocument(input: Parameters<VectorStore['upsertDocument']>[0]): Promise<void> {
    await this.documents.replaceDocument(input);
  }

  async deleteDocument(documentId: string): Promise<void> {
    await this.documents.deleteDocument(documentId);
  }

  async getDocument(documentId: string): Promise<IndexedDocumentMeta | null> {
    const row = await this.documents.findDocument(documentId);
    if (!row) {
      return null;
    }

    return {
      documentId: row.id,
      source: row.source,
      metadata: row.metadata,
      chunkCount: row.chunkCount,
      textHash: row.textHash,
      createdBy: row.createdBy ?? undefined,
    };
  }

  async query(embedding: number[], options: VectorQueryOptions) {
    const rows = await this.documents.listChunks({
      documentIds: options.documentIds,
      createdBy: options.createdBy,
      limit: this.maxScan,
    });
    const minScore = options.minScore ?? Number.NEGATIVE_INFINITY;
    const scored = rows
      .map((row) => {
        const chunk = toStoredChunk(row);
        return { ...chunk, score: cosineSimilarity(embedding, chunk.embedding) };
      })
      .filter((chunk) => chunk.score >= minScore)
      .sort((left, right) => right.score - left.score);

    return scored.slice(0, options.topK);
  }
}

export function createPostgresVectorStore(documents: RagRepository): PostgresVectorStore {
  return new PostgresVectorStore(documents);
}
