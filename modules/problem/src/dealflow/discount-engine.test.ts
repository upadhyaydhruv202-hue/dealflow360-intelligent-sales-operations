import { describe, expect, it } from 'vitest';

import { DEFAULT_CHAINS, DEFAULT_POLICIES, DEFAULT_PRODUCTS } from './defaults';
import { assessQuote, isMaterialChange, selectPolicy } from './discount-engine';

describe('discount engine', () => {
  it('selects the most specific policy for a gold software deal', () => {
    const policy = selectPolicy(DEFAULT_POLICIES, 'gold', 'software');
    expect(policy.name).toBe('Gold customer');
  });

  it('computes blended risk and picks a chain from configured thresholds', () => {
    const assessment = assessQuote({
      customerTier: 'standard',
      policies: DEFAULT_POLICIES,
      chains: DEFAULT_CHAINS,
      lines: [
        {
          line: {
            id: '1',
            quoteId: 'q',
            productId: DEFAULT_PRODUCTS[0].id,
            quantity: 1,
            listPrice: DEFAULT_PRODUCTS[0].listPrice,
            discountPercent: 16,
            unitCost: DEFAULT_PRODUCTS[0].cost,
          },
          product: DEFAULT_PRODUCTS[0],
        },
      ],
    });

    expect(assessment.decision).toBe('approval_required');
    expect(assessment.requiredChainName).toBe('Sales Manager → Finance');
    expect(assessment.blendedDiscountPercent).toBe(16);
    expect(assessment.reasons.some((reason) => reason.includes('approval ceiling'))).toBe(true);
  });

  it('detects material discount and amount changes', () => {
    expect(isMaterialChange({ blendedDiscountPercent: 5, netTotal: 1000 }, { blendedDiscountPercent: 8, netTotal: 1000 })).toBe(
      true,
    );
    expect(isMaterialChange({ blendedDiscountPercent: 5, netTotal: 1000 }, { blendedDiscountPercent: 5, netTotal: 890 })).toBe(
      true,
    );
    expect(isMaterialChange({ blendedDiscountPercent: 5, netTotal: 1000 }, { blendedDiscountPercent: 5.5, netTotal: 990 })).toBe(
      false,
    );
  });
});
