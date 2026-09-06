import { describe, expect, it } from 'vitest';

import { DEFAULT_GOVERNANCE } from './types';
import {
  actorDiscountCeiling,
  persistCustomerTier,
  wonPurchaseCountToTier,
} from './loyalty';

describe('loyalty ceilings', () => {
  it('maps won purchase counts to new, gold, and platinum', () => {
    expect(wonPurchaseCountToTier(0)).toBe('new');
    expect(wonPurchaseCountToTier(1)).toBe('new');
    expect(wonPurchaseCountToTier(2)).toBe('gold');
    expect(wonPurchaseCountToTier(4)).toBe('gold');
    expect(wonPurchaseCountToTier(5)).toBe('platinum');
    expect(persistCustomerTier('new')).toBe('standard');
    expect(persistCustomerTier('strategic')).toBe('platinum');
  });

  it('stacks role and loyalty then caps at the commercial maximum', () => {
    const staff = actorDiscountCeiling({
      authorities: [{ roleKey: 'staff', maxDiscountPercent: 5, minMarginPercent: 20, maxPriceOverridePercent: 0, canNegotiate: true, exceedAction: 'block' }],
      actor: { id: 's', role: 'staff', roles: ['staff'] },
      loyaltyTier: 'gold',
      config: DEFAULT_GOVERNANCE,
    });
    expect(staff.ceiling).toBe(10);

    const manager = actorDiscountCeiling({
      authorities: [{ roleKey: 'manager', maxDiscountPercent: 10, minMarginPercent: 18, maxPriceOverridePercent: 3, canNegotiate: true, exceedAction: 'block' }],
      actor: { id: 'm', role: 'manager', roles: ['manager'] },
      loyaltyTier: 'platinum',
      config: DEFAULT_GOVERNANCE,
    });
    expect(manager.ceiling).toBe(20);

    const capped = actorDiscountCeiling({
      authorities: [{ roleKey: 'finance', maxDiscountPercent: 15, minMarginPercent: 10, maxPriceOverridePercent: 5, canNegotiate: true, exceedAction: 'block' }],
      actor: { id: 'f', role: 'finance', roles: ['finance'] },
      loyaltyTier: 'platinum',
      config: { ...DEFAULT_GOVERNANCE, maxCommercialDiscountPercent: 18 },
    });
    expect(capped.ceiling).toBe(18);
  });
});
