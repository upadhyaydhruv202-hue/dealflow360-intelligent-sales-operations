import { describe, expect, it } from 'vitest';

import { toPortalView } from './portal-view';

describe('toPortalView', () => {
  it('strips internal approval, risk, and operational fields', () => {
    const view = toPortalView({
      id: 'q1',
      number: 'DF-00009',
      status: 'approved',
      listTotal: 100,
      discountTotal: 10,
      netTotal: 90,
      blendedDiscountPercent: 10,
      customer: { name: 'Northwind Retail' },
      lines: [
        {
          id: 'l1',
          quantity: 1,
          listPrice: 100,
          discountPercent: 10,
          product: { name: 'Core Gateway', sku: 'HW-CORE-1', billingType: 'one_time' },
        },
      ],
    });

    expect(view).toEqual({
      id: 'q1',
      number: 'DF-00009',
      status: 'approved',
      listTotal: 100,
      discountTotal: 10,
      netTotal: 90,
      blendedDiscountPercent: 10,
      version: 1,
      taxTotal: 0,
      grandTotal: 90,
      customerDecision: 'none',
      customer: { name: 'Northwind Retail' },
      lines: [
        {
          id: 'l1',
          quantity: 1,
          listPrice: 100,
          discountPercent: 10,
          product: { name: 'Core Gateway', sku: 'HW-CORE-1', billingType: 'one_time' },
        },
      ],
    });
    expect(view).not.toHaveProperty('approvals');
    expect(view).not.toHaveProperty('assessment');
    expect(view).not.toHaveProperty('riskScore');
    expect(view).not.toHaveProperty('marginPercent');
    expect(view).not.toHaveProperty('fulfillment');
    expect(view).not.toHaveProperty('ownerId');
  });
});
