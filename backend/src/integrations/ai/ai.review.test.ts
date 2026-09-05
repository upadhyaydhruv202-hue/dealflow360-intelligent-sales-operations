import { describe, expect, it } from 'vitest';

import {
  AI_LOW_CONFIDENCE_THRESHOLD,
  applyConfidenceReview,
  applyDraftReview,
  applyExtractReview,
  isLowConfidence,
} from './ai.review';

describe('AI review policy', () => {
  it('treats scores below the threshold as low confidence', () => {
    expect(isLowConfidence(AI_LOW_CONFIDENCE_THRESHOLD)).toBe(false);
    expect(isLowConfidence(AI_LOW_CONFIDENCE_THRESHOLD - 0.01)).toBe(true);
  });

  it('marks missing extract fields for review', () => {
    const reviewed = applyExtractReview(
      {
        fields: { orderId: '99', eta: null },
        missingFields: [],
        confidence: 0.9,
        warnings: [],
        requiresReview: false,
      },
      ['orderId', 'eta'],
    );

    expect(reviewed.missingFields).toEqual(['eta']);
    expect(reviewed.requiresReview).toBe(true);
  });

  it('marks low-confidence extract output for review even when fields are present', () => {
    const reviewed = applyExtractReview(
      {
        fields: { orderId: '99' },
        missingFields: [],
        confidence: 0.2,
        warnings: [],
        requiresReview: false,
      },
      ['orderId'],
    );

    expect(reviewed.requiresReview).toBe(true);
    expect(reviewed.missingFields).toEqual([]);
  });

  it('never clears an existing review flag on drafts', () => {
    expect(
      applyDraftReview({
        draft: 'We will look into this.',
        confidence: 0.99,
        requiresReview: false,
      }).requiresReview,
    ).toBe(true);
    expect(
      applyDraftReview({
        draft: 'We will look into this.',
        alternatives: ['Another wording.'],
        warnings: [],
        confidence: 0.99,
        requiresReview: true,
      }),
    ).toEqual(
      expect.objectContaining({
        alternatives: ['Another wording.'],
        warnings: [],
        requiresReview: true,
      }),
    );
  });

  it('raises analysis review when confidence is low', () => {
    expect(
      applyConfidenceReview({
        confidence: 0.1,
        requiresReview: false,
      }).requiresReview,
    ).toBe(true);
  });
});
