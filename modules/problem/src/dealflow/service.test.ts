import { describe, expect, it } from 'vitest';

import { DEFAULT_CUSTOMERS, DEFAULT_PRODUCTS, DEFAULT_WAREHOUSES } from './defaults';
import { createDealflowService } from './service';
import { createMemoryStore } from './store';
import type { Actor } from './types';

const staff: Actor = {
  id: '00000000-0000-4000-8000-0000000000a1',
  role: 'staff',
  roles: ['staff'],
  permissions: ['dealflow.quotes.write', 'dealflow.fulfillment.write', 'dealflow.billing.write'],
};

const manager: Actor = {
  id: '00000000-0000-4000-8000-0000000000a2',
  role: 'manager',
  roles: ['manager'],
  permissions: ['dealflow.quotes.approve', 'dealflow.approvals.manager'],
};

const finance: Actor = {
  id: '00000000-0000-4000-8000-0000000000a3',
  role: 'admin',
  roles: ['admin'],
  permissions: ['dealflow.quotes.approve', 'dealflow.approvals.finance', 'dealflow.approvals.final'],
};

function createService() {
  const records: Array<{ action: string; resourceId?: string }> = [];
  const service = createDealflowService({
    store: createMemoryStore(),
    audit: {
      async record(input) {
        records.push({ action: input.action, resourceId: input.resourceId });
      },
    },
  });
  return { service, records };
}

describe('DealFlow360 golden path', () => {
  it('routes an excessive discount through approval, fulfillment, hybrid billing, and confirmation', async () => {
    const { service, records } = createService();
    const created = (await service.createQuote(
      {
        customerId: DEFAULT_CUSTOMERS[0].id,
        lines: [
          { productId: DEFAULT_PRODUCTS[0].id, quantity: 8, discountPercent: 16 },
          { productId: DEFAULT_PRODUCTS[2].id, quantity: 1, discountPercent: 16 },
        ],
      },
      staff,
    )) as { id: string; assessmentDecision: string; status: string; lines: Array<{ id: string }> };

    const assessed = (await service.assess(created.id)) as {
      assessment: { decision: string; blendedDiscountPercent: number; requiredChainName: string };
    };
    expect(assessed.assessment.decision).toBe('approval_required');
    expect(assessed.assessment.blendedDiscountPercent).toBeGreaterThan(5);
    expect(assessed.assessment.requiredChainName).toBeTruthy();

    const submitted = (await service.submit(created.id, staff)) as {
      status: string;
      approvals: Array<{ id: string; roleKey: string; status: string }>;
    };
    expect(submitted.status).toBe('approval_required');
    expect(submitted.approvals.some((item) => item.status === 'pending')).toBe(true);

    let current = submitted;
    for (const step of current.approvals.filter((item) => item.status === 'pending')) {
      const actor = step.roleKey === 'manager' ? manager : finance;
      current = (await service.decide(created.id, step.id, { decision: 'approved', reason: `${step.roleKey} sign-off` }, actor)) as typeof submitted;
    }
    expect(current.status).toBe('approved');

    const recs = await service.recommendations(created.id);
    expect(recs.length).toBeGreaterThan(0);
    const withUpsell = (await service.applyRecommendation(created.id, recs[0].relationId, staff)) as {
      status: string;
      lines: unknown[];
    };
    expect(withUpsell.status).toBe('approved');
    expect(withUpsell.lines.length).toBe(3);

    const planned = (await service.planFulfillment(created.id, undefined, staff)) as {
      fulfillment: { shipmentCount: number; backorderQuantity: number; fulfillmentCost: number; allocations: unknown[] };
    };
    expect(planned.fulfillment.shipmentCount).toBeGreaterThanOrEqual(2);
    expect(planned.fulfillment.backorderQuantity).toBe(1);
    expect(planned.fulfillment.fulfillmentCost).toBeGreaterThan(0);

    const billed = (await service.generateBilling(created.id, staff)) as {
      billing: Array<{ billingType: string; status: string; amount: number }>;
    };
    expect(billed.billing.some((item) => item.billingType === 'one_time' && item.status === 'invoiced')).toBe(true);
    expect(billed.billing.some((item) => item.billingType === 'recurring' && item.status === 'scheduled')).toBe(true);

    const confirmed = (await service.confirm(created.id, staff)) as { status: string };
    expect(['confirmed', 'fulfillment', 'billing']).toContain(confirmed.status);
    expect(records.map((item) => item.action)).toEqual(
      expect.arrayContaining([
        'quote.created',
        'quote.submitted',
        'quote.approved',
        'quote.fulfillment_planned',
        'quote.billing_generated',
        'quote.confirmed',
      ]),
    );
  });

  it('invalidates approval after a material customer negotiation discount increase', async () => {
    const { service } = createService();
    const created = (await service.createQuote(
      {
        customerId: DEFAULT_CUSTOMERS[1].id,
        lines: [{ productId: DEFAULT_PRODUCTS[0].id, quantity: 1, discountPercent: 13 }],
      },
      staff,
    )) as { id: string; portalToken: string; lines: Array<{ id: string }>; approvals: Array<{ id: string }> };

    const submitted = (await service.submit(created.id, staff)) as {
      status: string;
      approvals: Array<{ id: string; status: string; roleKey: string }>;
    };
    expect(submitted.status).toBe('approval_required');
    let current = submitted;
    for (const step of current.approvals.filter((item) => item.status === 'pending')) {
      const actor = step.roleKey === 'manager' ? manager : finance;
      current = (await service.decide(created.id, step.id, { decision: 'approved', reason: 'ok' }, actor)) as typeof submitted;
    }
    expect(current.status).toBe('approved');

    await service.startNegotiation(created.id, staff);
    const negotiated = (await service.applyPortalChange(created.portalToken, {
      lines: [{ lineId: created.lines[0].id, discountPercent: 22 }],
    })) as { status: string; approvals: Array<{ id: string; status: string; roleKey: string }>; blendedDiscountPercent: number };

    expect(negotiated.status).toBe('approval_required');
    expect(negotiated.blendedDiscountPercent).toBe(22);
    expect(negotiated.approvals.some((item) => item.status === 'invalidated')).toBe(true);
    expect(negotiated.approvals.some((item) => item.status === 'pending')).toBe(true);

    let reapproved: { status: string; approvals: Array<{ id: string; status: string; roleKey: string }> } =
      negotiated;
    for (const step of reapproved.approvals.filter((item) => item.status === 'pending')) {
      const actor = step.roleKey === 'manager' ? manager : finance;
      reapproved = (await service.decide(created.id, step.id, { decision: 'approved', reason: 're-approve' }, actor)) as typeof submitted;
    }
    expect(reapproved.status).toBe('approved');
  });

  it('auto-approves quotes inside policy ceilings and rejects over-ceiling submits', async () => {
    const { service } = createService();
    const allowed = (await service.createQuote(
      {
        customerId: DEFAULT_CUSTOMERS[0].id,
        lines: [{ productId: DEFAULT_PRODUCTS[1].id, quantity: 1, discountPercent: 2 }],
      },
      staff,
    )) as { id: string };
    const submitted = (await service.submit(allowed.id, staff)) as { status: string; assessmentDecision: string };
    expect(submitted.status).toBe('approved');
    expect(submitted.assessmentDecision).toBe('allowed');

    const excessive = (await service.createQuote(
      {
        customerId: DEFAULT_CUSTOMERS[0].id,
        lines: [{ productId: DEFAULT_PRODUCTS[1].id, quantity: 1, discountPercent: 40 }],
      },
      staff,
    )) as { id: string };
    await expect(service.submit(excessive.id, staff)).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('escalates multiple smaller warnings via cumulative risk and recalculates after upsell', async () => {
    const { service } = createService();
    const created = (await service.createQuote(
      {
        customerId: DEFAULT_CUSTOMERS[0].id,
        lines: [
          { productId: DEFAULT_PRODUCTS[0].id, quantity: 1, discountPercent: 4 },
          { productId: DEFAULT_PRODUCTS[2].id, quantity: 1, discountPercent: 9 },
        ],
      },
      staff,
    )) as { id: string; netTotal: number; assessment: { decision: string; cumulativeEscalated: boolean } };

    const assessed = (await service.assess(created.id)) as {
      assessment: { decision: string; cumulativeEscalated: boolean };
      netTotal: number;
    };
    expect(assessed.assessment.cumulativeEscalated).toBe(true);
    expect(assessed.assessment.decision).toBe('approval_required');

    const recs = await service.recommendations(created.id);
    expect(recs.length).toBeGreaterThan(0);
    const applied = (await service.applyRecommendation(created.id, recs[0].relationId, staff)) as {
      netTotal: number;
      lines: unknown[];
    };
    expect(applied.lines.length).toBe(3);
    expect(applied.netTotal).toBeGreaterThan(assessed.netTotal);
  });

  it('honors manual warehouse overrides against real stock', async () => {
    const { service } = createService();
    const created = (await service.createQuote(
      {
        customerId: DEFAULT_CUSTOMERS[0].id,
        lines: [{ productId: DEFAULT_PRODUCTS[1].id, quantity: 2, discountPercent: 0 }],
      },
      staff,
    )) as { id: string; lines: Array<{ id: string }> };
    await service.submit(created.id, staff);
    const planned = (await service.planFulfillment(
      created.id,
      [{ quoteLineId: created.lines[0].id, warehouseId: DEFAULT_WAREHOUSES[1].id, quantity: 2 }],
      staff,
    )) as { fulfillment: { allocations: Array<{ warehouseId: string; isManualOverride: boolean; quantity: number }> } };

    expect(planned.fulfillment.allocations).toEqual([
      expect.objectContaining({
        warehouseId: DEFAULT_WAREHOUSES[1].id,
        isManualOverride: true,
        quantity: 2,
      }),
    ]);

    const oversized = (await service.createQuote(
      {
        customerId: DEFAULT_CUSTOMERS[0].id,
        lines: [{ productId: DEFAULT_PRODUCTS[1].id, quantity: 3, discountPercent: 0 }],
      },
      staff,
    )) as { id: string; lines: Array<{ id: string }> };
    await service.submit(oversized.id, staff);
    await expect(
      service.planFulfillment(
        oversized.id,
        [{ quoteLineId: oversized.lines[0].id, warehouseId: DEFAULT_WAREHOUSES[1].id, quantity: 3 }],
        staff,
      ),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});
