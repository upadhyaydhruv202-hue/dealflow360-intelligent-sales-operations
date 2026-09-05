import { describe, expect, it } from 'vitest';

import { DEFAULT_PRODUCTS, DEFAULT_QUANTITY_BREAKS, DEFAULT_ROLE_AUTHORITIES } from './defaults';
import { validateGovernance, validateQuantityBreaks, validateRoleAuthorities } from './governance-config';
import { DEFAULT_GOVERNANCE } from './types';

describe('governance configuration validation', () => {
  it('rejects overlapping active quantity ranges', () => {
    expect(() =>
      validateQuantityBreaks([
        ...DEFAULT_QUANTITY_BREAKS,
        {
          id: 'fffffff1-ffff-4fff-8fff-fffffffffff8',
          name: 'Overlap',
          productId: DEFAULT_PRODUCTS[0].id,
          minQuantity: 8,
          maxQuantity: 12,
          adjustmentKind: 'fixed',
          adjustmentValue: 3600,
          active: true,
        },
      ]),
    ).toThrow(/overlap/i);
  });

  it('allows an inactive overlapping range', () => {
    const next = validateQuantityBreaks([
      ...DEFAULT_QUANTITY_BREAKS,
      {
        id: 'fffffff1-ffff-4fff-8fff-fffffffffff8',
        name: 'Inactive overlap',
        productId: DEFAULT_PRODUCTS[0].id,
        minQuantity: 8,
        maxQuantity: 12,
        adjustmentKind: 'fixed',
        adjustmentValue: 3600,
        active: false,
      },
    ]);
    expect(next.some((item) => item.active === false)).toBe(true);
  });

  it('rejects duplicate role keys and invalid thresholds', () => {
    expect(() => validateRoleAuthorities([...DEFAULT_ROLE_AUTHORITIES, { ...DEFAULT_ROLE_AUTHORITIES[0] }])).toThrow(
      /Duplicate role/,
    );
    expect(() => validateGovernance({ ...DEFAULT_GOVERNANCE, maxApprovalLevels: 4 })).toThrow(/1 to 3/);
    expect(() => validateGovernance({ ...DEFAULT_GOVERNANCE, highValueNetTotal: -1 })).toThrow(/High-value/);
  });
});
