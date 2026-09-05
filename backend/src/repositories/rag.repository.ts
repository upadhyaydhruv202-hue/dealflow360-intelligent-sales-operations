import type { PrismaClient } from '@prisma/client';
import { NotFoundError } from '../errors';
import { mapPrismaError } from '../lib/prisma-error';
import { withTransaction } from '../lib/transaction';
import type { RagChunkMetadata, StoredChunk, UpsertDocumentInput } from '../integrations/rag/rag.types';
import type { DbClient } from './types';

export interface RagDocumentRow {
  id: string;
  source: string;
  metadata: RagChunkMetadata;
  textHash: string;
  chunkCount: number;
  createdBy: string | null;
}

export interface RagChunkRow {
  id: string;
  documentId: string;
  chunkIndex: number;
  source: string;
  content: string;
  metadata: RagChunkMetadata;
  embedding: number[];
  embeddingModel: string;
}

export class RagRepository {
  constructor(private readonly db: DbClient) {}

  async replaceDocument(input: UpsertDocumentInput): Promise<void> {
    try {
      if ('$transaction' in this.db) {
        await withTransaction(this.db as PrismaClient, async (tx) => {
          await this.writeDocument(tx, input);
        });
        return;
      }

      await this.writeDocument(this.db, input);
    } catch (error) {
      mapPrismaError(error);
    }
  }

  private async writeDocument(tx: DbClient, input: UpsertDocumentInput): Promise<void> {
    await tx.ragChunk.deleteMany({ where: { documentId: input.documentId } });
    await tx.ragDocument.upsert({
      where: { id: input.documentId },
      create: {
        id: input.documentId,
        source: input.source,
        metadata: input.metadata,
        textHash: input.textHash,
        chunkCount: input.chunks.length,
        createdBy: asUserId(input.createdBy),
      },
      update: {
        source: input.source,
        metadata: input.metadata,
        textHash: input.textHash,
        chunkCount: input.chunks.length,
        createdBy: asUserId(input.createdBy),
      },
    });
    if (input.chunks.length === 0) {
      return;
    }
    await tx.ragChunk.createMany({
      data: input.chunks.map((chunk) => ({
        id: chunk.chunkId,
        documentId: chunk.documentId,
        chunkIndex: chunk.chunkIndex,
        source: chunk.source,
        content: chunk.content,
        metadata: chunk.metadata,
        embedding: chunk.embedding,
        embeddingModel: chunk.embeddingModel,
      })),
    });
  }

  async deleteDocument(documentId: string): Promise<void> {
    try {
      const result = await this.db.ragDocument.deleteMany({ where: { id: documentId } });
      if (result.count === 0) {
        throw new NotFoundError('RAG document not found', { documentId });
      }
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async findDocument(documentId: string): Promise<RagDocumentRow | null> {
    try {
      const row = await this.db.ragDocument.findUnique({ where: { id: documentId } });
      if (!row) {
        return null;
      }
      return {
        id: row.id,
        source: row.source,
        metadata: asMetadata(row.metadata),
        textHash: row.textHash,
        chunkCount: row.chunkCount,
        createdBy: row.createdBy,
      };
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async listChunks(options: {
    documentIds?: string[];
    createdBy?: string;
    limit: number;
  }): Promise<RagChunkRow[]> {
    try {
      const rows = await this.db.ragChunk.findMany({
        where: {
          ...(options.documentIds?.length ? { documentId: { in: options.documentIds } } : {}),
          ...(options.createdBy ? { document: { createdBy: options.createdBy } } : {}),
        },
        take: options.limit,
        orderBy: [{ documentId: 'asc' }, { chunkIndex: 'asc' }],
      });
      return rows.map((row) => ({
        id: row.id,
        documentId: row.documentId,
        chunkIndex: row.chunkIndex,
        source: row.source,
        content: row.content,
        metadata: asMetadata(row.metadata),
        embedding: asEmbedding(row.embedding),
        embeddingModel: row.embeddingModel,
      }));
    } catch (error) {
      mapPrismaError(error);
    }
  }
}

export function toStoredChunk(row: RagChunkRow): StoredChunk {
  return {
    chunkId: row.id,
    documentId: row.documentId,
    chunkIndex: row.chunkIndex,
    source: row.source,
    content: row.content,
    metadata: row.metadata,
    embedding: row.embedding,
    embeddingModel: row.embeddingModel,
  };
}

function asMetadata(value: unknown): RagChunkMetadata {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const metadata: RagChunkMetadata = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'string' || typeof entry === 'number' || typeof entry === 'boolean' || entry === null) {
      metadata[key] = entry;
    }
  }
  return metadata;
}

function asUserId(value: string | undefined): string | undefined {
  if (!value || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    return undefined;
  }

  return value;
}

function asEmbedding(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is number => typeof item === 'number' && Number.isFinite(item));
}
