import { NotFoundError } from '../../../errors';
import { cosineSimilarity } from '../rag.similarity';
import type {
  IndexedDocumentMeta,
  StoredChunk,
  UpsertDocumentInput,
  VectorQueryOptions,
  VectorStore,
} from '../rag.types';

interface MemoryDocument extends IndexedDocumentMeta {
  createdBy?: string;
  chunks: StoredChunk[];
}

export class MemoryVectorStore implements VectorStore {
  private readonly documents = new Map<string, MemoryDocument>();

  async upsertDocument(input: UpsertDocumentInput): Promise<void> {
    this.documents.set(input.documentId, {
      documentId: input.documentId,
      source: input.source,
      metadata: { ...input.metadata },
      chunkCount: input.chunks.length,
      textHash: input.textHash,
      createdBy: input.createdBy,
      chunks: input.chunks.map((chunk) => ({ ...chunk, metadata: { ...chunk.metadata } })),
    });
  }

  async deleteDocument(documentId: string): Promise<void> {
    if (!this.documents.delete(documentId)) {
      throw new NotFoundError('RAG document not found', { documentId });
    }
  }

  async getDocument(documentId: string): Promise<IndexedDocumentMeta | null> {
    const document = this.documents.get(documentId);
    if (!document) {
      return null;
    }

    return {
      documentId: document.documentId,
      source: document.source,
      metadata: { ...document.metadata },
      chunkCount: document.chunkCount,
      textHash: document.textHash,
      createdBy: document.createdBy,
    };
  }

  async query(embedding: number[], options: VectorQueryOptions) {
    const allowed = options.documentIds ? new Set(options.documentIds) : null;
    const minScore = options.minScore ?? Number.NEGATIVE_INFINITY;
    const scored = [];

    for (const document of this.documents.values()) {
      if (allowed && !allowed.has(document.documentId)) {
        continue;
      }
      if (options.createdBy && document.createdBy !== options.createdBy) {
        continue;
      }

      for (const chunk of document.chunks) {
        const score = cosineSimilarity(embedding, chunk.embedding);
        if (score >= minScore) {
          scored.push({ ...chunk, metadata: { ...chunk.metadata }, score });
        }
      }
    }

    scored.sort((left, right) => right.score - left.score);
    return scored.slice(0, options.topK);
  }
}

export function createMemoryVectorStore(): MemoryVectorStore {
  return new MemoryVectorStore();
}
