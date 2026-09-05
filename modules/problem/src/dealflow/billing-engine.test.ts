import { describe, expect, it } from 'vitest';

import { buildBillingSchedules, cancelSchedule } from './billing-engine';
import { DEFAULT_PRODUCTS } from './defaults';

describe('billing engine', () => {
  it('splits one-time invoices from recurring schedules', () => {
    const schedules = buildBillingSchedules({
      quoteId: 'q1',
      now: new Date('2026-01-01T00:00:00.000Z'),
      products: DEFAULT_PRODUCTS,
      lines: [
        {
          id: 'l1',
          quoteId: 'q1',
          productId: DEFAULT_PRODUCTS[0].id,
          quantity: 1,
          listPrice: 4000,
          discountPercent: 10,
          unitCost: 2200,
        },
        {
          id: 'l2',
          quoteId: 'q1',
          productId: DEFAULT_PRODUCTS[2].id,
          quantity: 1,
          listPrice: 2400,
          discountPercent: 0,
          unitCost: 400,
        },
      ],
    });

    expect(schedules).toEqual([
      expect.objectContaining({ billingType: 'one_time', status: 'invoiced', amount: 3600 }),
      expect.objectContaining({
        billingType: 'recurring',
        frequency: 'monthly',
        status: 'scheduled',
        amount: 2400,
        nextBillingAt: '2026-01-31T00:00:00.000Z',
      }),
    ]);
  });

  it('prorates a refund when a recurring schedule is cancelled mid-cycle', () => {
    const cancelled = cancelSchedule({
      now: new Date('2026-01-16T00:00:00.000Z'),
      schedule: {
        id: 's1',
        quoteId: 'q1',
        quoteLineId: 'l2',
        billingType: 'recurring',
        frequency: 'monthly',
        amount: 300,
        status: 'scheduled',
        nextBillingAt: '2026-01-31T00:00:00.000Z',
        prorationAmount: 0,
        refundAmount: 0,
      },
    });

    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.refundAmount).toBeGreaterThan(0);
    expect(cancelled.prorationAmount).toBeGreaterThan(0);
    expect(cancelled.refundAmount + cancelled.prorationAmount).toBeCloseTo(300);
  });
});
