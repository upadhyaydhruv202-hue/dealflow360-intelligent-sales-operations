import { describe, expect, it } from 'vitest';

import { DEFAULT_CUSTOMERS, DEFAULT_PRODUCTS } from './defaults';
import { computeDealHealth } from './health-engine';
import { emptyAggregate } from './store';
import { DEFAULT_GOVERNANCE } from './types';

describe('computeDealHealth', () => {
  it('explains stale approval and discount signals without using random scores', () => {
    const createdAt = '2026-08-01T00:00:00.000Z';
    const updatedAt = '2026-08-20T00:00:00.000Z';
    const aggregate = emptyAggregate({
      id: 'q1',
      number: 'DF-00001',
      customerId: DEFAULT_CUSTOMERS[0].id,
      status: 'approval_required',
      listTotal: 10000,
      discountTotal: 3000,
      netTotal: 7000,
      costTotal: 4000,
      marginPercent: 18,
      blendedDiscountPercent: 30,
      riskScore: 80,
      assessmentDecision: 'approval_required',
      portalToken: 'token',
      version: 2,
      taxTotal: 0,
      customerDecision: 'none',
      createdAt,
      updatedAt,
    });
    aggregate.customer = DEFAULT_CUSTOMERS[0];
    aggregate.products = [DEFAULT_PRODUCTS[0]];
    aggregate.approvals = [
      {
        id: 'a1',
        quoteId: 'q1',
        chainId: 'c1',
        stepOrder: 1,
        roleKey: 'manager',
        label: 'Manager',
        status: 'pending',
      },
    ];

    const health = computeDealHealth(aggregate, undefined, DEFAULT_GOVERNANCE, Date.parse('2026-08-28T00:00:00.000Z'));
    expect(health.score).toBeLessThan(75);
    expect(health.status).not.toBe('healthy');
    expect(health.explanation.length).toBeGreaterThan(20);
    expect(health.factors.some((factor) => factor.id === 'stale')).toBe(true);
    expect(health.factors.some((factor) => factor.id === 'discount')).toBe(true);
    expect(health.recommendedAction.length).toBeGreaterThan(10);
  });
});
