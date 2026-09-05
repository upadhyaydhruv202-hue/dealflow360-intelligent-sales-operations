import { describe, expect, it, vi } from 'vitest';

import type { RagRepository } from '../../../repositories/rag.repository';
import { PostgresVectorStore } from './postgres.store';

describe('PostgresVectorStore', () => {
  it('ranks repository chunks by cosine similarity', async () => {
    const listChunks = vi.fn(async () => [
      {
        id: 'doc-a:0000',
        documentId: 'doc-a',
        chunkIndex: 0,
        source: 'A',
        content: 'alpha',
        metadata: {},
        embedding: [1, 0],
        embeddingModel: 'test',
      },
      {
        id: 'doc-b:0000',
        documentId: 'doc-b',
        chunkIndex: 0,
        source: 'B',
        content: 'beta',
        metadata: {},
        embedding: [0, 1],
        embeddingModel: 'test',
      },
    ]);
    const store = new PostgresVectorStore({ listChunks } as unknown as RagRepository);

    const hits = await store.query([1, 0], { topK: 1, minScore: 0.5 });
    expect(listChunks).toHaveBeenCalled();
    expect(hits).toHaveLength(1);
    expect(hits[0]?.documentId).toBe('doc-a');
    expect(hits[0]?.score).toBeCloseTo(1);
  });
});
