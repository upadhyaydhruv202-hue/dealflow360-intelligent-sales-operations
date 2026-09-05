import { describe, expect, it } from 'vitest';

import { applyDocumentReview } from './document.review';

describe('document review policy', () => {
  it('marks low confidence for review', () => {
    const reviewed = applyDocumentReview(
      {
        fields: { invoiceNumber: '42' },
        missingFields: [],
        confidence: 0.2,
        warnings: [],
        requiresReview: false,
      },
      { requestedFields: ['invoiceNumber'], threshold: 0.7 },
    );

    expect(reviewed.requiresReview).toBe(true);
    expect(reviewed.fields.invoiceNumber).toBe('42');
  });

  it('nullifies values the model listed as missing instead of keeping invented data', () => {
    const reviewed = applyDocumentReview(
      {
        fields: { invoiceNumber: 'GUESSED', total: '99.00' },
        missingFields: ['invoiceNumber'],
        confidence: 0.9,
        warnings: [],
        requiresReview: false,
      },
      { requestedFields: ['invoiceNumber', 'total'], threshold: 0.7 },
    );

    expect(reviewed.fields.invoiceNumber).toBeNull();
    expect(reviewed.fields.total).toBe('99.00');
    expect(reviewed.missingFields).toContain('invoiceNumber');
    expect(reviewed.requiresReview).toBe(true);
  });
});
