import { describe, expect, it } from 'vitest';

import { cosineSimilarity, l2Normalize } from './rag.similarity';

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1);
  });

  it('returns 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it('returns 0 for empty or zero vectors', () => {
    expect(cosineSimilarity([], [1])).toBe(0);
    expect(cosineSimilarity([0, 0], [1, 2])).toBe(0);
  });

  it('normalizes a vector to unit length', () => {
    const normalized = l2Normalize([3, 4]);
    expect(Math.hypot(normalized[0] ?? 0, normalized[1] ?? 0)).toBeCloseTo(1);
  });
});
