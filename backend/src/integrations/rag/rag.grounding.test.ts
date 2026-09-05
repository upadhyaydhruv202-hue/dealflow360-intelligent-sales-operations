import { describe, expect, it } from 'vitest';

import { applyGroundingPolicy, INSUFFICIENT_EVIDENCE_ANSWER } from './rag.grounding';
import type { RetrievedChunk } from './rag.types';

const chunk: RetrievedChunk = {
  documentId: 'doc-1',
  chunkId: 'doc-1:0000',
  source: 'Policy',
  content: 'Refunds are allowed within 14 days.',
  metadata: {},
  score: 0.81,
};

describe('applyGroundingPolicy', () => {
  it('keeps only sources that match retrieved chunks', () => {
    const result = applyGroundingPolicy(
      {
        answer: 'Refunds are allowed within 14 days.',
        grounded: true,
        confidence: 0.9,
        sources: [
          { documentId: 'doc-1', chunkId: 'doc-1:0000', quote: 'Refunds are allowed within 14 days.' },
          { documentId: 'invented', chunkId: 'nope', quote: 'Made up' },
        ],
      },
      [chunk],
    );

    expect(result.grounded).toBe(true);
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0]?.chunkId).toBe('doc-1:0000');
  });

  it('forces ungrounded when the model cites nothing real', () => {
    const result = applyGroundingPolicy(
      {
        answer: 'The wifi password is hunter2.',
        grounded: true,
        confidence: 0.99,
        sources: [{ documentId: 'invented', chunkId: 'nope' }],
      },
      [chunk],
    );

    expect(result.grounded).toBe(false);
    expect(result.sources).toEqual([]);
    expect(result.answer).toBe(INSUFFICIENT_EVIDENCE_ANSWER);
  });
});
