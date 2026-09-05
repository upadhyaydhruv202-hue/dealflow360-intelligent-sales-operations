import { describe, expect, it } from 'vitest';

import { RecursiveCharacterChunker } from './rag.chunker';

describe('RecursiveCharacterChunker', () => {
  it('returns a single chunk for short text', () => {
    const chunker = new RecursiveCharacterChunker({ chunkSize: 80, overlap: 10 });
    const chunks = chunker.chunk('Refunds are allowed within 14 days.');
    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.chunkIndex).toBe(0);
    expect(chunks[0]?.content).toContain('Refunds');
  });

  it('splits long text and keeps overlap', () => {
    const chunker = new RecursiveCharacterChunker({ chunkSize: 40, overlap: 8, maxChunks: 20 });
    const text = Array.from(
      { length: 12 },
      (_, index) => `Paragraph ${index + 1} about shipping refunds.`,
    ).join('\n\n');
    const chunks = chunker.chunk(text);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.content.length > 0)).toBe(true);
  });

  it('returns no chunks for blank input', () => {
    const chunker = new RecursiveCharacterChunker();
    expect(chunker.chunk('   \n')).toEqual([]);
  });

  it('rejects documents that would exceed the chunk cap', () => {
    const chunker = new RecursiveCharacterChunker({ chunkSize: 12, overlap: 0, maxChunks: 2 });
    expect(() => chunker.chunk('one two three four five six seven eight nine ten')).toThrow(
      /too many chunks/i,
    );
  });
});
