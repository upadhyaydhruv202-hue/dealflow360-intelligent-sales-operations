import { describe, expect, it } from 'vitest';

import { DEFAULT_CUSTOMERS, DEFAULT_PRODUCTS, DEFAULT_WAREHOUSES } from './defaults';
import { createDealflowService } from './service';
import { createMemoryStore } from './store';
import { DEFAULT_GOVERNANCE, type Actor } from './types';

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
      version: number;
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
    const withUpsell = (await service.applyRecommendation(created.id, recs[0].relationId, staff, current.version ?? 1)) as {
      status: string;
      lines: unknown[];
      version: number;
    };
    expect(withUpsell.status).toBe('approved');
    expect(withUpsell.lines.length).toBe(3);

    const planned = (await service.planFulfillment(created.id, undefined, staff, withUpsell.version)) as {
      fulfillment: { shipmentCount: number; backorderQuantity: number; fulfillmentCost: number; allocations: unknown[] };
      version: number;
    };
    expect(planned.fulfillment.shipmentCount).toBeGreaterThanOrEqual(2);
    expect(planned.fulfillment.backorderQuantity).toBe(1);
    expect(planned.fulfillment.fulfillmentCost).toBeGreaterThan(0);

    const billed = (await service.generateBilling(created.id, staff, planned.version)) as {
      billing: Array<{ billingType: string; status: string; amount: number }>;
      version: number;
    };
    expect(billed.billing.some((item) => item.billingType === 'one_time' && item.status === 'invoiced')).toBe(true);
    expect(billed.billing.some((item) => item.billingType === 'recurring' && item.status === 'scheduled')).toBe(true);

    const confirmed = (await service.confirm(created.id, staff, billed.version)) as { status: string };
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

    const opened = (await service.startNegotiation(created.id, staff)) as { version: number };
    const negotiated = (await service.applyPortalChange(created.portalToken, {
      expectedVersion: opened.version,
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
    )) as { id: string; version: number; netTotal: number; assessment: { decision: string; cumulativeEscalated: boolean } };

    const assessed = (await service.assess(created.id)) as {
      assessment: { decision: string; cumulativeEscalated: boolean };
      netTotal: number;
    };
    expect(assessed.assessment.cumulativeEscalated).toBe(true);
    expect(assessed.assessment.decision).toBe('approval_required');

    const recs = await service.recommendations(created.id);
    expect(recs.length).toBeGreaterThan(0);
    const applied = (await service.applyRecommendation(created.id, recs[0].relationId, staff, created.version ?? 1)) as {
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
    const submitted = (await service.submit(created.id, staff)) as { version: number };
    const planned = (await service.planFulfillment(
      created.id,
      [{ quoteLineId: created.lines[0].id, warehouseId: DEFAULT_WAREHOUSES[1].id, quantity: 2 }],
      staff,
      submitted.version,
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
    const oversizedSubmitted = (await service.submit(oversized.id, staff)) as { version: number };
    await expect(
      service.planFulfillment(
        oversized.id,
        [{ quoteLineId: oversized.lines[0].id, warehouseId: DEFAULT_WAREHOUSES[1].id, quantity: 3 }],
        staff,
        oversizedSubmitted.version,
      ),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('exposes quantity breaks and role authority on the catalog', async () => {
    const { service } = createService();
    const catalog = await service.catalog();
    expect(catalog.quantityBreaks.length).toBeGreaterThan(0);
    expect(catalog.roleAuthorities.some((item) => item.roleKey === 'staff' && item.maxDiscountPercent === 5)).toBe(true);
    expect(catalog.governance.maxApprovalLevels).toBe(3);
  });

  it('reprices a line when quantity crosses a volume break and records vendor contact', async () => {
    const { service, records } = createService();
    const created = (await service.createQuote(
      {
        customerId: DEFAULT_CUSTOMERS[0].id,
        lines: [{ productId: DEFAULT_PRODUCTS[0].id, quantity: 9, discountPercent: 0 }],
      },
      staff,
    )) as { id: string; version: number; lines: Array<{ id: string; listPrice: number }>; netTotal: number };
    expect(created.lines[0]?.listPrice).toBe(4000);

    const updated = (await service.updateLine(
      created.id,
      created.lines[0].id,
      { quantity: 10, expectedVersion: created.version },
      staff,
    )) as { version: number; lines: Array<{ listPrice: number; quantity: number }>; assessment: { lines: Array<{ appliedPrice: number }> } };
    expect(updated.lines[0]?.quantity).toBe(10);
    expect(updated.lines[0]?.listPrice).toBe(3700);
    expect(updated.assessment.lines[0]?.appliedPrice).toBe(3700);

    const limited = (await service.updateLine(
      created.id,
      created.lines[0].id,
      { discountPercent: 8, expectedVersion: updated.version },
      staff,
    )) as { assessment: { reasons: string[] } };
    expect(limited.assessment.reasons.some((reason) => reason.includes('authorized range 5%'))).toBe(true);

    const vendor = await service.contactVendor(
      created.id,
      { productId: DEFAULT_PRODUCTS[0].id, message: 'Confirm 10-unit lead time' },
      staff,
    );
    expect(vendor).toEqual({ recorded: true, delivered: false, channel: 'audit', quoteId: created.id });
    expect(records.map((item) => item.action)).toContain('quote.vendor_contacted');
  });

  it('recalculates portal quantity changes through the same pricing engine', async () => {
    const { service } = createService();
    const created = (await service.createQuote(
      {
        customerId: DEFAULT_CUSTOMERS[0].id,
        lines: [{ productId: DEFAULT_PRODUCTS[0].id, quantity: 1, discountPercent: 0 }],
      },
      staff,
    )) as { id: string; portalToken: string; lines: Array<{ id: string }> };
    const submitted = (await service.submit(created.id, staff)) as { status: string };
    expect(submitted.status).toBe('approved');
    const opened = (await service.startNegotiation(created.id, staff)) as { version: number };
    const negotiated = (await service.applyPortalChange(created.portalToken, {
      expectedVersion: opened.version,
      lines: [{ lineId: created.lines[0].id, quantity: 10 }],
    })) as { lines: Array<{ quantity: number; listPrice: number }> };
    expect(negotiated.lines[0]?.quantity).toBe(10);
    expect(negotiated.lines[0]?.listPrice).toBe(3700);
  });

  it('rejects stale quote edits and persists validated governance changes', async () => {
    const { service, records } = createService();
    const created = (await service.createQuote(
      {
        customerId: DEFAULT_CUSTOMERS[0].id,
        lines: [{ productId: DEFAULT_PRODUCTS[0].id, quantity: 1, discountPercent: 0 }],
      },
      staff,
    )) as { id: string; version: number; lines: Array<{ id: string }> };

    await expect(
      service.updateLine(created.id, created.lines[0].id, { quantity: 2, expectedVersion: created.version + 1 }, staff),
    ).rejects.toMatchObject({ code: 'CONFLICT', message: 'Quotation updated by another user.' });

    const first = (await service.updateLine(
      created.id,
      created.lines[0].id,
      { quantity: 2, expectedVersion: created.version },
      staff,
    )) as { version: number };
    await expect(
      service.updateLine(created.id, created.lines[0].id, { quantity: 3, expectedVersion: created.version }, staff),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(first.version).toBe(created.version + 1);

    const admin: Actor = { id: finance.id, role: 'admin', roles: ['admin'], permissions: ['dealflow.catalog.write'] };
    const catalog = await service.catalog();
    await expect(
      service.replaceQuantityBreaks(
        [
          ...catalog.quantityBreaks,
          {
            id: 'fffffff1-ffff-4fff-8fff-fffffffffff9',
            name: 'Overlap',
            productId: DEFAULT_PRODUCTS[0].id,
            minQuantity: 5,
            maxQuantity: 12,
            adjustmentKind: 'fixed',
            adjustmentValue: 3500,
            active: true,
          },
        ],
        admin,
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });

    const saved = await service.updateGovernance({ highValueNetTotal: 30_000 }, admin);
    expect(saved.highValueNetTotal).toBe(30_000);
    expect((await service.catalog()).governance.highValueNetTotal).toBe(30_000);
    expect(records.map((item) => item.action)).toContain('governance.settings_updated');
  });

  it('rejects stale fulfill, bill, and confirm mutations without overwriting', async () => {
    const { service } = createService();
    const created = (await service.createQuote(
      {
        customerId: DEFAULT_CUSTOMERS[0].id,
        lines: [
          { productId: DEFAULT_PRODUCTS[0].id, quantity: 1, discountPercent: 0 },
          { productId: DEFAULT_PRODUCTS[2].id, quantity: 1, discountPercent: 0 },
        ],
      },
      staff,
    )) as { id: string; version: number };
    const submitted = (await service.submit(created.id, staff)) as { version: number; status: string };
    expect(submitted.status).toBe('approved');

    await expect(service.planFulfillment(created.id, undefined, staff, submitted.version + 1)).rejects.toMatchObject({
      code: 'CONFLICT',
      message: 'Quotation updated by another user.',
    });
    const planned = (await service.planFulfillment(created.id, undefined, staff, submitted.version)) as {
      version: number;
      status: string;
    };
    expect(planned.version).toBe(submitted.version + 1);

    await expect(service.generateBilling(created.id, staff, submitted.version)).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    const billed = (await service.generateBilling(created.id, staff, planned.version)) as { version: number };
    expect(billed.version).toBe(planned.version + 1);

    await expect(service.confirm(created.id, staff, planned.version)).rejects.toMatchObject({ code: 'CONFLICT' });
    const confirmed = (await service.confirm(created.id, staff, billed.version)) as { status: string };
    expect(['confirmed', 'fulfillment', 'billing']).toContain(confirmed.status);
  });

  it('persists authorized unit-price overrides and refuses to wipe them on discount edits', async () => {
    const { service } = createService();
    const created = (await service.createQuote(
      {
        customerId: DEFAULT_CUSTOMERS[0].id,
        lines: [{ productId: DEFAULT_PRODUCTS[0].id, quantity: 1, discountPercent: 0 }],
      },
      staff,
    )) as { id: string; version: number; lines: Array<{ id: string }> };

    const overridden = (await service.updateLine(
      created.id,
      created.lines[0].id,
      { unitPrice: 3900, expectedVersion: created.version },
      staff,
    )) as {
      version: number;
      lines: Array<{ listPrice: number }>;
      assessment: { decision: string; reasons: string[]; lines: Array<{ appliedPrice: number }> };
    };
    expect(overridden.lines[0]?.listPrice).toBe(3900);
    expect(overridden.assessment.lines[0]?.appliedPrice).toBe(3900);
    expect(overridden.assessment.decision).toBe('approval_required');
    expect(overridden.assessment.reasons.some((reason) => reason.includes('Unit price override'))).toBe(true);

    const discounted = (await service.updateLine(
      created.id,
      created.lines[0].id,
      { discountPercent: 2, expectedVersion: overridden.version },
      staff,
    )) as { version: number; lines: Array<{ listPrice: number; discountPercent: number }> };
    expect(discounted.lines[0]?.listPrice).toBe(3900);
    expect(discounted.lines[0]?.discountPercent).toBe(2);

    const managerOverride = (await service.updateLine(
      created.id,
      created.lines[0].id,
      { unitPrice: 3880, expectedVersion: discounted.version },
      manager,
    )) as { assessment: { decision: string; reasons: string[] }; lines: Array<{ listPrice: number }> };
    expect(managerOverride.lines[0]?.listPrice).toBe(3880);
    expect(managerOverride.assessment.reasons.some((reason) => reason.includes('Unit price override'))).toBe(false);
  });

  it('provisions a customer record and lists only that buyer’s portal quotes', async () => {
    const { service } = createService();
    const buyer = (await service.provisionCustomer({
      email: 'buyer@example.com',
      displayName: 'Casey Buyer',
      companyName: 'Buyer Co',
    })) as { id: string; name: string; email: string };
    expect(buyer.name).toBe('Buyer Co');
    expect(buyer.email).toBe('buyer@example.com');

    const created = (await service.createQuote(
      { customerId: buyer.id, lines: [{ productId: DEFAULT_PRODUCTS[0].id, quantity: 1, discountPercent: 0 }] },
      staff,
    )) as { portalToken: string; number: string };
    const other = (await service.createQuote(
      {
        customerId: DEFAULT_CUSTOMERS[1].id,
        lines: [{ productId: DEFAULT_PRODUCTS[0].id, quantity: 1, discountPercent: 0 }],
      },
      staff,
    )) as { number: string };

    const mine = (await service.listMyQuotes({
      id: 'customer-user',
      email: 'buyer@example.com',
      role: 'user',
      roles: ['user'],
      permissions: [],
    })) as Array<{ number: string; portalToken: string; customer: { name: string }; riskScore?: number }>;
    expect(mine).toHaveLength(1);
    expect(mine[0]?.number).toBe(created.number);
    expect(mine[0]?.portalToken).toBe(created.portalToken);
    expect(mine[0]?.customer.name).toBe('Buyer Co');
    expect(mine[0]?.riskScore).toBeUndefined();
    expect(mine.some((item) => item.number === other.number)).toBe(false);

    const empty = await service.listMyQuotes({
      id: 'stranger',
      email: 'nobody@example.com',
      role: 'user',
    });
    expect(empty).toEqual([]);
  });

  it('records a portal accept/decline on the quote and keeps health server-side', async () => {
    const { service, records } = createService();
    const created = (await service.createQuote(
      {
        customerId: DEFAULT_CUSTOMERS[0].id,
        lines: [{ productId: DEFAULT_PRODUCTS[0].id, quantity: 1, discountPercent: 0 }],
      },
      staff,
    )) as { id: string; portalToken: string; version: number; health: { score: number; explanation: string } };
    expect(created.health.score).toBeGreaterThan(0);
    expect(created.health.explanation).toBeTruthy();

    const submitted = (await service.submit(created.id, staff)) as { status: string; version: number };
    expect(submitted.status).toBe('approved');
    const accepted = (await service.applyPortalDecision(created.portalToken, {
      expectedVersion: submitted.version,
      action: 'accepted',
      comment: 'Please proceed',
    })) as { customerDecision: string };
    expect(accepted.customerDecision).toBe('accepted');
    expect(records.some((item) => item.action === 'quote.customer_accepted')).toBe(true);

    await expect(
      service.applyPortalDecision(created.portalToken, { expectedVersion: submitted.version, action: 'declined' }),
    ).rejects.toThrow(/another user/i);
  });

  it('applies configured tax into quote totals and persists detected anomalies', async () => {
    const records: Array<{ action: string }> = [];
    const service = createDealflowService({
      store: createMemoryStore(),
      config: { ...DEFAULT_GOVERNANCE, taxRatePercent: 10, unusualDiscountPercent: 10 },
      audit: {
        async record(input) {
          records.push({ action: input.action });
        },
      },
    });
    const created = (await service.createQuote(
      {
        customerId: DEFAULT_CUSTOMERS[0].id,
        lines: [{ productId: DEFAULT_PRODUCTS[0].id, quantity: 1, discountPercent: 16 }],
      },
      staff,
    )) as { id: string; taxTotal: number; grandTotal: number; netTotal: number };
    expect(created.taxTotal).toBeGreaterThan(0);
    expect(created.grandTotal).toBeCloseTo(created.netTotal + created.taxTotal, 2);

    const anomalies = await service.listAnomalies();
    expect(anomalies.some((item) => item.type === 'unusual_discount')).toBe(true);
    const disposed = await service.disposeAnomaly(anomalies[0].id, { status: 'acknowledged' }, staff);
    expect(disposed.status).toBe('acknowledged');
    expect(records.some((item) => item.action === 'anomaly.detected')).toBe(true);
    expect(records.some((item) => item.action === 'anomaly.disposed')).toBe(true);
  });

  it('renders a customer-safe PDF from the current quote', async () => {
    const { service } = createService();
    const created = (await service.createQuote(
      {
        customerId: DEFAULT_CUSTOMERS[0].id,
        lines: [{ productId: DEFAULT_PRODUCTS[0].id, quantity: 1, discountPercent: 0 }],
      },
      staff,
    )) as { id: string };
    const pdf = await service.customerQuotePdf(created.id, staff);
    const text = pdf.toString('latin1');
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
    expect(text.toLowerCase()).not.toContain('margin');
    expect(text.toLowerCase()).not.toContain('risk score');
  });

  it('isolates customer quote listing and portal payloads from internal fields', async () => {
    const { service } = createService();
    await service.createQuote(
      {
        customerId: DEFAULT_CUSTOMERS[0].id,
        lines: [{ productId: DEFAULT_PRODUCTS[0].id, quantity: 1, discountPercent: 0 }],
      },
      staff,
    );
    const mine = (await service.listMyQuotes({
      id: staff.id,
      role: 'user',
      email: DEFAULT_CUSTOMERS[0].email,
    })) as Array<Record<string, unknown>>;
    expect(mine).toHaveLength(1);
    expect(mine[0]).not.toHaveProperty('marginPercent');
    expect(mine[0]).not.toHaveProperty('riskScore');
    expect(mine[0]).not.toHaveProperty('approvals');
    expect(mine[0]).not.toHaveProperty('fulfillment');

    const portal = (await service.getQuoteByToken(String(mine[0].portalToken))) as Record<string, unknown>;
    expect(portal).not.toHaveProperty('marginPercent');
    expect(portal).not.toHaveProperty('assessment');
    expect(portal).not.toHaveProperty('health');
  });
});
