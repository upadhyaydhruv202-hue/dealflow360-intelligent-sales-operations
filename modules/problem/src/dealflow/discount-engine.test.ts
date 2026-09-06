import { describe, expect, it } from 'vitest';

import {
  DEFAULT_CHAINS,
  DEFAULT_POLICIES,
  DEFAULT_PRODUCTS,
  DEFAULT_QUANTITY_BREAKS,
  DEFAULT_ROLE_AUTHORITIES,
} from './defaults';
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

  it('reprices a line when quantity crosses a configured break', () => {
    const assessment = assessQuote({
      customerTier: 'standard',
      policies: DEFAULT_POLICIES,
      chains: DEFAULT_CHAINS,
      quantityBreaks: DEFAULT_QUANTITY_BREAKS,
      lines: [
        {
          line: {
            id: '1',
            quoteId: 'q',
            productId: DEFAULT_PRODUCTS[0].id,
            quantity: 10,
            listPrice: 3700,
            discountPercent: 0,
            unitCost: DEFAULT_PRODUCTS[0].cost,
          },
          product: DEFAULT_PRODUCTS[0],
        },
      ],
    });
    expect(assessment.lines[0]?.appliedPrice).toBe(3700);
    expect(assessment.listTotal).toBe(37000);
    expect(assessment.reasons.some((reason) => reason.includes('Within Default ceiling'))).toBe(true);
  });

  it('rejects staff discounts that exceed their configured range', () => {
    const assessment = assessQuote({
      customerTier: 'standard',
      policies: DEFAULT_POLICIES,
      chains: DEFAULT_CHAINS,
      roleAuthorities: DEFAULT_ROLE_AUTHORITIES,
      actor: { id: 'staff-1', role: 'staff', roles: ['staff'], permissions: [] },
      lines: [
        {
          line: {
            id: '1',
            quoteId: 'q',
            productId: DEFAULT_PRODUCTS[0].id,
            quantity: 1,
            listPrice: DEFAULT_PRODUCTS[0].listPrice,
            discountPercent: 8,
            unitCost: DEFAULT_PRODUCTS[0].cost,
          },
          product: DEFAULT_PRODUCTS[0],
        },
      ],
    });
    expect(assessment.decision).toBe('rejected');
    expect(assessment.lines[0]?.roleLimitExceeded).toBe(true);
    expect(assessment.reasons.some((reason) => reason.includes('authorized range 5%'))).toBe(true);
  });

  it('flags high-value quotes without inserting an admin-only chain', () => {
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
            quantity: 8,
            listPrice: DEFAULT_PRODUCTS[0].listPrice,
            discountPercent: 0,
            unitCost: DEFAULT_PRODUCTS[0].cost,
          },
          product: DEFAULT_PRODUCTS[0],
        },
      ],
    });
    expect(assessment.highValue).toBe(true);
    expect(assessment.decision).toBe('approval_required');
    expect(assessment.requiredChainName).not.toMatch(/admin/i);
    expect(assessment.reasons.some((reason) => reason.includes('High-value approval'))).toBe(true);
  });

  it('keeps multi-line approvals itemized when merge would hide product risk', () => {
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
        {
          line: {
            id: '2',
            quoteId: 'q',
            productId: DEFAULT_PRODUCTS[2].id,
            quantity: 1,
            listPrice: DEFAULT_PRODUCTS[2].listPrice,
            discountPercent: 16,
            unitCost: DEFAULT_PRODUCTS[2].cost,
          },
          product: DEFAULT_PRODUCTS[2],
        },
      ],
    });
    expect(assessment.mergeRisk).toBe(true);
    expect(assessment.lines.filter((line) => line.approvalScope === 'line')).toHaveLength(2);
    expect(assessment.mergeRiskReasons?.[0]).toMatch(/stay itemized/);
  });

  it('requires approval when staff override a unit price beyond maxPriceOverridePercent', () => {
    const assessment = assessQuote({
      customerTier: 'standard',
      policies: DEFAULT_POLICIES,
      chains: DEFAULT_CHAINS,
      quantityBreaks: DEFAULT_QUANTITY_BREAKS,
      roleAuthorities: DEFAULT_ROLE_AUTHORITIES,
      actor: { id: 'staff-1', role: 'staff', roles: ['staff'], permissions: [] },
      lines: [
        {
          line: {
            id: '1',
            quoteId: 'q',
            productId: DEFAULT_PRODUCTS[0].id,
            quantity: 1,
            listPrice: 3900,
            discountPercent: 0,
            unitCost: DEFAULT_PRODUCTS[0].cost,
          },
          product: DEFAULT_PRODUCTS[0],
        },
      ],
    });
    expect(assessment.decision).toBe('rejected');
    expect(assessment.lines[0]?.appliedPrice).toBe(3900);
    expect(assessment.lines[0]?.roleLimitExceeded).toBe(true);
    expect(assessment.reasons.some((reason) => reason.includes('Unit price override'))).toBe(true);
  });

  it('allows a manager unit-price override inside the configured percent', () => {
    const assessment = assessQuote({
      customerTier: 'standard',
      policies: DEFAULT_POLICIES,
      chains: DEFAULT_CHAINS,
      quantityBreaks: DEFAULT_QUANTITY_BREAKS,
      roleAuthorities: DEFAULT_ROLE_AUTHORITIES,
      actor: { id: 'mgr-1', role: 'manager', roles: ['manager'], permissions: [] },
      lines: [
        {
          line: {
            id: '1',
            quoteId: 'q',
            productId: DEFAULT_PRODUCTS[0].id,
            quantity: 1,
            listPrice: 3900,
            discountPercent: 0,
            unitCost: DEFAULT_PRODUCTS[0].cost,
          },
          product: DEFAULT_PRODUCTS[0],
        },
      ],
    });
    expect(assessment.decision).toBe('allowed');
    expect(assessment.lines[0]?.appliedPrice).toBe(3900);
    expect(assessment.reasons.some((reason) => reason.includes('Unit price override'))).toBe(false);
  });

  it('assesses duplicate products as separate line nets', () => {
    const product = DEFAULT_PRODUCTS[0];
    const assessment = assessQuote({
      customerTier: 'standard',
      policies: DEFAULT_POLICIES,
      chains: DEFAULT_CHAINS,
      lines: [
        {
          line: {
            id: 'line-a',
            quoteId: 'q',
            productId: product.id,
            quantity: 3,
            listPrice: 4000,
            discountPercent: 4,
            unitCost: product.cost,
          },
          product,
        },
        {
          line: {
            id: 'line-b',
            quoteId: 'q',
            productId: product.id,
            quantity: 2,
            listPrice: 4000,
            discountPercent: 4,
            unitCost: product.cost,
          },
          product,
        },
        {
          line: {
            id: 'line-c',
            quoteId: 'q',
            productId: product.id,
            quantity: 1,
            listPrice: 4000,
            discountPercent: 4,
            unitCost: product.cost,
          },
          product,
        },
      ],
    });

    expect(assessment.lines.map((line) => ({ id: line.lineId, net: line.netAmount }))).toEqual([
      { id: 'line-a', net: 11520 },
      { id: 'line-b', net: 7680 },
      { id: 'line-c', net: 3840 },
    ]);
    expect(assessment.netTotal).toBe(23040);
  });
});
