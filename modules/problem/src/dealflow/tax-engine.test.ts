import { describe, expect, it } from 'vitest';

import { DEFAULT_PRODUCTS } from './defaults';
import { computeTaxTotal } from './tax-engine';
import { DEFAULT_GOVERNANCE } from './types';

describe('computeTaxTotal', () => {
  const line = {
    id: 'l1',
    quoteId: 'q1',
    productId: DEFAULT_PRODUCTS[0].id,
    quantity: 2,
    listPrice: 100,
    discountPercent: 10,
    unitCost: 40,
  };

  it('returns 0 when the configured tax rate is 0', () => {
    expect(computeTaxTotal([line], DEFAULT_PRODUCTS, DEFAULT_GOVERNANCE)).toBe(0);
  });

  it('taxes only taxable product nets at the configured rate', () => {
    const exempt = { ...DEFAULT_PRODUCTS[0], taxable: false };
    const taxed = computeTaxTotal([line], DEFAULT_PRODUCTS, { ...DEFAULT_GOVERNANCE, taxRatePercent: 10 });
    const skipped = computeTaxTotal([line], [exempt], { ...DEFAULT_GOVERNANCE, taxRatePercent: 10 });
    expect(taxed).toBe(18);
    expect(skipped).toBe(0);
  });
});
