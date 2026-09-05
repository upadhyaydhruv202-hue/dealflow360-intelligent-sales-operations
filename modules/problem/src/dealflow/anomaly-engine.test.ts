import { describe, expect, it } from 'vitest';

import { detectQuoteAnomalies } from './anomaly-engine';
import { DEFAULT_CUSTOMERS, DEFAULT_PRODUCTS } from './defaults';
import { emptyAggregate } from './store';
import { DEFAULT_GOVERNANCE } from './types';

describe('detectQuoteAnomalies', () => {
  it('flags unusual discount, large deal, and stale activity from real quote signals', () => {
    const aggregate = emptyAggregate({
      id: 'q1',
      number: 'DF-01048',
      customerId: DEFAULT_CUSTOMERS[0].id,
      status: 'approval_required',
      listTotal: 80_000,
      discountTotal: 28_000,
      netTotal: 52_000,
      costTotal: 20_000,
      marginPercent: 18,
      blendedDiscountPercent: 35,
      riskScore: 90,
      assessmentDecision: 'approval_required',
      portalToken: 'token',
      version: 3,
      taxTotal: 0,
      customerDecision: 'none',
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-20T00:00:00.000Z',
    });
    aggregate.customer = DEFAULT_CUSTOMERS[0];
    aggregate.products = [DEFAULT_PRODUCTS[0]];

    const found = detectQuoteAnomalies(aggregate, undefined, DEFAULT_GOVERNANCE, new Date('2026-08-28T00:00:00.000Z'));
    expect(found.some((item) => item.type === 'unusual_discount')).toBe(true);
    expect(found.some((item) => item.type === 'large_deal')).toBe(true);
    expect(found.some((item) => item.type === 'stale_deal')).toBe(true);
    expect(found.every((item) => item.description.includes('DF-01048'))).toBe(true);
  });
});
