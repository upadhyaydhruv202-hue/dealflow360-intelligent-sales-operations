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
  permissions: ['dealflow.quotes.write', 'dealflow.quotes.approve', 'dealflow.approvals.manager'],
};

const finance: Actor = {
  id: '00000000-0000-4000-8000-0000000000a3',
  role: 'finance',
  roles: ['finance'],
  permissions: ['dealflow.quotes.lock', 'dealflow.quotes.approve', 'dealflow.approvals.finance', 'dealflow.approvals.final'],
};

const director: Actor = {
  id: '00000000-0000-4000-8000-0000000000a4',
  role: 'admin',
  roles: ['admin'],
  permissions: ['dealflow.quotes.lock', 'dealflow.quotes.approve', 'dealflow.approvals.finance', 'dealflow.approvals.final', 'dealflow.catalog.write'],
};

function createService() {
  const records: Array<{ action: string; resourceId?: string }> = [];
  const emails: Array<{ eventType: string; to: string; subject: string; idempotencyKey: string }> = [];
  const service = createDealflowService({
    store: createMemoryStore(),
    audit: {
      async record(input) {
        records.push({ action: input.action, resourceId: input.resourceId });
      },
    },
    sendCustomerEmail: async (input) => {
      emails.push({
        eventType: input.eventType,
        to: input.to,
        subject: input.subject,
        idempotencyKey: input.idempotencyKey,
      });
      return { status: 'not_configured', error: 'Email provider is not configured' };
    },
  });
  return { service, records, emails };
}

async function approvePending(
  service: ReturnType<typeof createDealflowService>,
  quoteId: string,
  current: { status: string; version: number; approvals: Array<{ id: string; roleKey: string; status: string }> },
) {
  let next = current;
  for (const step of next.approvals.filter((item) => item.status === 'pending')) {
    const actor = step.roleKey === 'manager' ? manager : step.roleKey === 'final' ? director : finance;
    next = (await service.decide(quoteId, step.id, { decision: 'approved', reason: `${step.roleKey} sign-off` }, actor)) as typeof next;
  }
  return next;
}

async function finalizeFromDraft(
  service: ReturnType<typeof createDealflowService>,
  quoteId: string,
  version: number,
) {
  const sent = (await service.sendNegotiationToManager(quoteId, undefined, staff, version)) as { version: number };
  return (await service.finalizeQuotation(quoteId, manager, sent.version)) as { version: number; status: string };
}

describe('DealFlow360 commercial workflow', () => {
  it('walks note → manager replace → agree → finalize → approval → finance lock → fulfillment and billing', async () => {
    const { service, records } = createService();
    const created = (await service.createQuote(
      {
        customerId: DEFAULT_CUSTOMERS[0].id,
        lines: [
          { productId: DEFAULT_PRODUCTS[0].id, quantity: 8, discountPercent: 5 },
          { productId: DEFAULT_PRODUCTS[2].id, quantity: 1, discountPercent: 5 },
        ],
      },
      staff,
    )) as { id: string; version: number; lines: Array<{ id: string; discountPercent: number }> };

    await expect(
      service.createQuote(
        {
          customerId: DEFAULT_CUSTOMERS[0].id,
          lines: [{ productId: DEFAULT_PRODUCTS[0].id, quantity: 1, discountPercent: 6 }],
        },
        staff,
      ),
    ).rejects.toMatchObject({ code: 'AUTHORIZATION_ERROR' });

    const noted = (await service.createNegotiationRequest(
      created.id,
      {
        expectedVersion: created.version,
        note: 'Please consider 16% to match a competing bid',
        requestedDiscountPercent: 16,
      },
      { id: 'portal', role: 'user' },
    )) as { version: number; status: string; negotiations: Array<{ note: string }> };
    expect(noted.status).toBe('customer_negotiation');
    expect(noted.negotiations[0]?.note).toMatch(/16%/);

    const sent = (await service.sendNegotiationToManager(created.id, undefined, staff, noted.version)) as {
      version: number;
      status: string;
    };
    expect(sent.status).toBe('manager_review');

    const revised = (await service.reviseAsManager(
      created.id,
      {
        expectedVersion: sent.version,
        lines: created.lines.map((line) => ({ lineId: line.id, discountPercent: 10 })),
      },
      manager,
    )) as { version: number; lines: Array<{ discountPercent: number }> };
    expect(revised.lines.every((line) => line.discountPercent === 10)).toBe(true);

    const returned = (await service.returnRevisedQuote(created.id, undefined, manager, revised.version)) as {
      version: number;
      status: string;
    };
    const agreed = (await service.agreeToFinal(created.id, { expectedVersion: returned.version })) as {
      version: number;
    };
    const finalized = (await service.finalizeQuotation(created.id, manager, agreed.version)) as {
      version: number;
      status: string;
    };
    expect(finalized.status).toBe('finalized');

    const submitted = (await service.submit(created.id, staff)) as {
      status: string;
      version: number;
      approvals: Array<{ id: string; roleKey: string; status: string }>;
    };
    const current =
      submitted.status === 'approved' ? submitted : await approvePending(service, created.id, submitted);
    expect(current.status).toBe('approved');
    await expect(service.confirm(created.id, staff, current.version)).rejects.toMatchObject({ code: 'AUTHORIZATION_ERROR' });

    const locked = (await service.lockDeal(created.id, finance, current.version)) as {
      status: string;
      version: number;
      customerEmails?: Array<{ eventType: string; status: string; payload?: { payableAmount?: number } }>;
    };
    expect(['confirmed', 'fulfillment', 'billing']).toContain(locked.status);
    const approvedView = current as { customerEmails?: Array<{ eventType: string; status: string }> };
    expect(approvedView.customerEmails?.some((item) => item.eventType === 'prelim_invoice')).toBe(true);
    expect(locked.customerEmails?.some((item) => item.eventType === 'final_invoice' && item.status === 'not_configured')).toBe(
      true,
    );

    const recs = await service.recommendations(created.id);
    expect(recs.length).toBeGreaterThan(0);
    await expect(service.applyRecommendation(created.id, recs[0].relationId, staff, locked.version)).rejects.toMatchObject({
      code: 'CONFLICT',
    });

    const planned = (await service.planFulfillment(created.id, undefined, staff, locked.version)) as {
      fulfillment: { shipmentCount: number; backorderQuantity: number; fulfillmentCost: number };
      version: number;
    };
    expect(planned.fulfillment.shipmentCount).toBeGreaterThanOrEqual(1);
    expect(planned.fulfillment.fulfillmentCost).toBeGreaterThan(0);

    const billed = (await service.generateBilling(created.id, staff, planned.version)) as {
      billing: Array<{ billingType: string; status: string }>;
    };
    expect(billed.billing.some((item) => item.billingType === 'one_time' && item.status === 'invoiced')).toBe(true);
    expect(billed.billing.some((item) => item.billingType === 'recurring' && item.status === 'scheduled')).toBe(true);
    expect(records.map((item) => item.action)).toEqual(
      expect.arrayContaining(['quote.created', 'quote.finalized', 'quote.submitted', 'quote.confirmed']),
    );
  });

  it('replaces a lower-role discount and hard-rejects over-cap writes', async () => {
    const { service } = createService();
    const created = (await service.createQuote(
      {
        customerId: DEFAULT_CUSTOMERS[0].id,
        lines: [{ productId: DEFAULT_PRODUCTS[0].id, quantity: 1, discountPercent: 5 }],
      },
      staff,
    )) as { id: string; version: number; lines: Array<{ id: string }> };
    await expect(
      service.updateLine(created.id, created.lines[0].id, { discountPercent: 6, expectedVersion: created.version }, staff),
    ).rejects.toMatchObject({ code: 'AUTHORIZATION_ERROR' });
    const sent = (await service.sendNegotiationToManager(created.id, undefined, staff, created.version)) as {
      version: number;
    };
    await expect(
      service.reviseAsManager(
        created.id,
        { expectedVersion: sent.version, lines: [{ lineId: created.lines[0].id, discountPercent: 11 }] },
        manager,
      ),
    ).rejects.toMatchObject({ code: 'AUTHORIZATION_ERROR' });
    const revised = (await service.reviseAsManager(
      created.id,
      { expectedVersion: sent.version, lines: [{ lineId: created.lines[0].id, discountPercent: 10 }] },
      manager,
    )) as { lines: Array<{ discountPercent: number }> };
    expect(revised.lines[0]?.discountPercent).toBe(10);
    await expect(
      service.createQuote(
        {
          customerId: DEFAULT_CUSTOMERS[0].id,
          lines: [{ productId: DEFAULT_PRODUCTS[0].id, quantity: 1, discountPercent: 16 }],
        },
        { ...finance, permissions: [...(finance.permissions ?? []), 'dealflow.quotes.write'] },
      ),
    ).rejects.toMatchObject({ code: 'AUTHORIZATION_ERROR' });
  });

  it('auto-approves finalized quotes inside policy ceilings and refuses submit before finalize', async () => {
    const { service } = createService();
    const allowed = (await service.createQuote(
      {
        customerId: DEFAULT_CUSTOMERS[0].id,
        lines: [{ productId: DEFAULT_PRODUCTS[1].id, quantity: 1, discountPercent: 2 }],
      },
      staff,
    )) as { id: string; version: number };
    await expect(service.submit(allowed.id, staff)).rejects.toMatchObject({ code: 'CONFLICT' });
    const finalized = await finalizeFromDraft(service, allowed.id, allowed.version);
    const submitted = (await service.submit(allowed.id, staff)) as { status: string; assessmentDecision: string };
    expect(submitted.status).toBe('approved');
    expect(submitted.assessmentDecision).toBe('allowed');
    expect(finalized.status).toBe('finalized');
  });

  it('escalates multiple smaller warnings via cumulative risk and recalculates after upsell', async () => {
    const { service } = createService();
    const created = (await service.createQuote(
      {
        customerId: DEFAULT_CUSTOMERS[0].id,
        lines: [
          { productId: DEFAULT_PRODUCTS[0].id, quantity: 1, discountPercent: 4 },
          { productId: DEFAULT_PRODUCTS[1].id, quantity: 1, discountPercent: 4 },
          { productId: DEFAULT_PRODUCTS[2].id, quantity: 1, discountPercent: 0 },
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
    expect(applied.lines.length).toBe(4);
    expect(applied.netTotal).toBeGreaterThan(assessed.netTotal);
  });

  it('honors manual warehouse overrides against real stock after finance lock', async () => {
    const { service } = createService();
    const created = (await service.createQuote(
      {
        customerId: DEFAULT_CUSTOMERS[0].id,
        lines: [{ productId: DEFAULT_PRODUCTS[1].id, quantity: 2, discountPercent: 0 }],
      },
      staff,
    )) as { id: string; version: number; lines: Array<{ id: string }> };
    const finalized = await finalizeFromDraft(service, created.id, created.version);
    const submitted = (await service.submit(created.id, staff)) as {
      status: string;
      version: number;
      approvals: Array<{ id: string; roleKey: string; status: string }>;
    };
    const approved =
      submitted.status === 'approved' ? submitted : await approvePending(service, created.id, submitted);
    const locked = (await service.lockDeal(created.id, finance, approved.version)) as { version: number };
    const planned = (await service.planFulfillment(
      created.id,
      [{ quoteLineId: created.lines[0].id, warehouseId: DEFAULT_WAREHOUSES[1].id, quantity: 2 }],
      staff,
      locked.version,
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
    )) as { id: string; version: number; lines: Array<{ id: string }> };
    const oversizedFinal = await finalizeFromDraft(service, oversized.id, oversized.version);
    const oversizedSubmitted = (await service.submit(oversized.id, staff)) as {
      status: string;
      version: number;
      approvals: Array<{ id: string; roleKey: string; status: string }>;
    };
    const oversizedApproved =
      oversizedSubmitted.status === 'approved'
        ? oversizedSubmitted
        : await approvePending(service, oversized.id, oversizedSubmitted);
    const oversizedLocked = (await service.lockDeal(oversized.id, finance, oversizedApproved.version)) as { version: number };
    await expect(
      service.planFulfillment(
        oversized.id,
        [{ quoteLineId: oversized.lines[0].id, warehouseId: DEFAULT_WAREHOUSES[1].id, quantity: 3 }],
        staff,
        oversizedLocked.version,
      ),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(oversizedFinal.status).toBe('finalized');
    expect(finalized.status).toBe('finalized');
  });

  it('exposes quantity breaks and role authority on the catalog', async () => {
    const { service } = createService();
    const catalog = await service.catalog();
    expect(catalog.quantityBreaks.length).toBeGreaterThan(0);
    expect(catalog.roleAuthorities.some((item) => item.roleKey === 'staff' && item.maxDiscountPercent === 5)).toBe(true);
    expect(catalog.roleAuthorities.some((item) => item.roleKey === 'admin')).toBe(false);
    expect(catalog.governance.maxApprovalLevels).toBe(3);
    expect(catalog.governance.maxCommercialDiscountPercent).toBe(25);
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

    await expect(
      service.updateLine(created.id, created.lines[0].id, { discountPercent: 8, expectedVersion: updated.version }, staff),
    ).rejects.toMatchObject({ code: 'AUTHORIZATION_ERROR' });

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
    )) as { id: string; portalToken: string; lines: Array<{ id: string }>; version: number };
    const negotiated = (await service.applyPortalChange(created.portalToken, {
      expectedVersion: created.version,
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
        director,
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });

    const saved = await service.updateGovernance({ highValueNetTotal: 30_000 }, director);
    expect(saved.highValueNetTotal).toBe(30_000);
    expect((await service.catalog()).governance.highValueNetTotal).toBe(30_000);
    expect(records.map((item) => item.action)).toContain('governance.settings_updated');
  });

  it('rejects stale fulfill, bill, and lock mutations without overwriting', async () => {
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
    const finalized = await finalizeFromDraft(service, created.id, created.version);
    const submitted = (await service.submit(created.id, staff)) as {
      status: string;
      version: number;
      approvals: Array<{ id: string; roleKey: string; status: string }>;
    };
    const approved =
      submitted.status === 'approved' ? submitted : await approvePending(service, created.id, submitted);
    expect(approved.status).toBe('approved');

    await expect(service.planFulfillment(created.id, undefined, staff, approved.version)).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    await expect(service.lockDeal(created.id, finance, approved.version + 1)).rejects.toMatchObject({
      code: 'CONFLICT',
      message: 'Quotation updated by another user.',
    });
    const locked = (await service.lockDeal(created.id, finance, approved.version)) as {
      version: number;
      status: string;
      lines: Array<{ id: string }>;
    };
    expect(['confirmed', 'fulfillment', 'billing']).toContain(locked.status);
    await expect(
      service.updateLine(
        created.id,
        locked.lines[0].id,
        { discountPercent: 1, expectedVersion: locked.version },
        staff,
      ),
    ).rejects.toMatchObject({ code: 'CONFLICT' });

    await expect(service.planFulfillment(created.id, undefined, staff, locked.version + 1)).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    const planned = (await service.planFulfillment(created.id, undefined, staff, locked.version)) as { version: number };
    await expect(service.generateBilling(created.id, staff, locked.version)).rejects.toMatchObject({ code: 'CONFLICT' });
    const billed = (await service.generateBilling(created.id, staff, planned.version)) as { version: number };
    expect(billed.version).toBe(planned.version + 1);
    expect(finalized.status).toBe('finalized');
  });

  it('refuses unauthorized unit-price overrides and lets a manager apply an in-range override', async () => {
    const { service } = createService();
    const created = (await service.createQuote(
      {
        customerId: DEFAULT_CUSTOMERS[0].id,
        lines: [{ productId: DEFAULT_PRODUCTS[0].id, quantity: 1, discountPercent: 0 }],
      },
      staff,
    )) as { id: string; version: number; lines: Array<{ id: string }> };

    await expect(
      service.updateLine(created.id, created.lines[0].id, { unitPrice: 3900, expectedVersion: created.version }, staff),
    ).rejects.toMatchObject({ code: 'AUTHORIZATION_ERROR' });

    const managerOverride = (await service.updateLine(
      created.id,
      created.lines[0].id,
      { unitPrice: 3880, expectedVersion: created.version },
      manager,
    )) as { lines: Array<{ listPrice: number }>; assessment: { reasons: string[] } };
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

    const accepted = (await service.applyPortalDecision(created.portalToken, {
      expectedVersion: created.version,
      action: 'accepted',
      comment: 'Please proceed',
    })) as { customerDecision: string };
    expect(accepted.customerDecision).toBe('accepted');
    expect(records.some((item) => item.action === 'quote.customer_accepted')).toBe(true);

    await expect(
      service.applyPortalDecision(created.portalToken, { expectedVersion: created.version, action: 'declined' }),
    ).rejects.toThrow(/another user/i);
  });

  it('applies configured tax into quote totals and persists detected anomalies', async () => {
    const records: Array<{ action: string }> = [];
    const service = createDealflowService({
      store: createMemoryStore(),
      config: { ...DEFAULT_GOVERNANCE, taxRatePercent: 10, unusualDiscountPercent: 4 },
      audit: {
        async record(input) {
          records.push({ action: input.action });
        },
      },
    });
    const created = (await service.createQuote(
      {
        customerId: DEFAULT_CUSTOMERS[0].id,
        lines: [{ productId: DEFAULT_PRODUCTS[0].id, quantity: 1, discountPercent: 5 }],
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

  it('computes loyalty from won quotations and persists catalog products', async () => {
    const store = createMemoryStore();
    const records: Array<{ action: string; resourceId?: string }> = [];
    const service = createDealflowService({
      store,
      audit: {
        async record(input) {
          records.push({ action: input.action, resourceId: input.resourceId });
        },
      },
    });
    const customerId = DEFAULT_CUSTOMERS[0].id;
    const presentLoyalty = async () =>
      (
        (await service.getQuote(
          (
            (await service.listQuotes()) as Array<{ id: string; customerId: string }>
          ).find((item) => item.customerId === customerId)?.id as string,
          staff,
        )) as { loyalty: { tier: string; wonPurchaseCount: number; bonusPercent: number } }
      ).loyalty;
    for (let index = 0; index < 5; index += 1) {
      const created = (await service.createQuote(
        { customerId, lines: [{ productId: DEFAULT_PRODUCTS[1].id, quantity: 1, discountPercent: 0 }] },
        staff,
      )) as { id: string; version: number };
      const finalized = await finalizeFromDraft(service, created.id, created.version);
      const submitted = (await service.submit(created.id, staff)) as {
        status: string;
        version: number;
        approvals: Array<{ id: string; roleKey: string; status: string }>;
      };
      const approved =
        submitted.status === 'approved' ? submitted : await approvePending(service, created.id, submitted);
      await service.lockDeal(created.id, finance, approved.version);
      expect(finalized.status).toBe('finalized');
      if (index === 1) {
        const gold = await presentLoyalty();
        expect(gold.tier).toBe('gold');
        expect(gold.wonPurchaseCount).toBe(2);
        expect(gold.bonusPercent).toBe(5);
      }
    }
    const presented = (await service.getQuote(
      (
        (await service.listQuotes()) as Array<{ id: string; customerId: string }>
      ).find((item) => item.customerId === customerId)?.id as string,
      staff,
    )) as { loyalty: { tier: string; wonPurchaseCount: number; bonusPercent: number } };
    expect(presented.loyalty.tier).toBe('platinum');
    expect(presented.loyalty.wonPurchaseCount).toBe(5);
    expect(presented.loyalty.bonusPercent).toBe(10);

    const product = await service.upsertProduct(
      {
        sku: 'HW-NEW-9',
        name: 'New Gateway',
        category: 'hardware',
        listPrice: 1000,
        cost: 400,
        billingType: 'one_time',
        description: 'Created in test',
      },
      director,
    );
    expect(product.sku).toBe('HW-NEW-9');
    expect((await service.catalog()).products.some((item) => item.sku === 'HW-NEW-9')).toBe(true);

    const officer: Actor = {
      ...staff,
      permissions: [...(staff.permissions ?? []), 'dealflow.catalog.products.write'],
    };
    const analytics = await service.upsertProduct(
      {
        sku: 'EA-2026-001',
        name: 'Enterprise Analytics',
        category: 'analytics',
        listPrice: 5000,
        cost: 800,
        billingType: 'recurring',
        billingFrequency: 'monthly',
        taxCategory: 'saas',
        taxRatePercent: 8,
        stock: [{ warehouseId: DEFAULT_WAREHOUSES[0].id, quantityOnHand: 25 }],
      },
      officer,
    );
    expect(analytics.billingType).toBe('recurring');
    expect((await service.catalog()).stock.some((item) => item.productId === analytics.id && item.quantityOnHand === 25)).toBe(true);
    expect(records.some((item) => item.action === 'catalog.product_created' && item.resourceId === analytics.id)).toBe(true);

    await expect(
      service.upsertProduct(
        {
          sku: 'EA-2026-002',
          name: 'Analytics Discount Bypass',
          category: 'analytics',
          listPrice: 5000,
          cost: 800,
          billingType: 'recurring',
          billingFrequency: 'monthly',
          quantityBreaks: [
            {
              name: 'Unauthorized 20%',
              minQuantity: 1,
              adjustmentKind: 'percent',
              adjustmentValue: -20,
            },
          ],
        },
        officer,
      ),
    ).rejects.toMatchObject({ code: 'AUTHORIZATION_ERROR' });

    await expect(
      service.upsertProduct(
        {
          sku: 'EA-2026-001',
          name: 'Duplicate Analytics',
          category: 'analytics',
          listPrice: 1,
          cost: 0,
          billingType: 'recurring',
          billingFrequency: 'monthly',
        },
        officer,
      ),
    ).rejects.toMatchObject({ code: 'CONFLICT', message: 'SKU already exists. Please use a unique SKU.' });

    await expect(
      service.upsertPolicy(
        {
          name: 'Unauthorized 20%',
          warningPercent: 20,
          approvalPercent: 20,
          rejectPercent: 40,
          maxMarginImpactPercent: 40,
          priority: 1,
        },
        officer,
      ),
    ).rejects.toMatchObject({ code: 'AUTHORIZATION_ERROR' });

    const inactive = await service.upsertProduct(
      { ...analytics, id: analytics.id, active: false },
      officer,
    );
    expect(inactive.active).toBe(false);
    await expect(
      service.createQuote(
        { customerId: DEFAULT_CUSTOMERS[0].id, lines: [{ productId: analytics.id, quantity: 1, discountPercent: 0 }] },
        staff,
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });

    const policy = await service.upsertPolicy(
      {
        name: 'HTTP Policy',
        warningPercent: 2,
        approvalPercent: 4,
        rejectPercent: 20,
        maxMarginImpactPercent: 8,
        priority: 50,
        description: 'Created in test',
      },
      director,
    );
    expect(policy.name).toBe('HTTP Policy');
    expect((await service.catalog()).policies.some((item) => item.id === policy.id)).toBe(true);
  });

  it('records one provisional email on manager approval and one final email on finance lock', async () => {
    const { service, emails } = createService();
    const created = (await service.createQuote(
      {
        customerId: DEFAULT_CUSTOMERS[0].id,
        lines: [{ productId: DEFAULT_PRODUCTS[1].id, quantity: 1, discountPercent: 0 }],
      },
      staff,
    )) as { id: string; version: number };
    const finalized = await finalizeFromDraft(service, created.id, created.version);
    const submitted = (await service.submit(created.id, staff)) as {
      status: string;
      version: number;
      approvals: Array<{ id: string; roleKey: string; status: string }>;
      customerEmails?: Array<{ eventType: string; status: string }>;
    };
    const approved =
      submitted.status === 'approved' ? submitted : await approvePending(service, created.id, submitted);
    expect(approved.status).toBe('approved');
    expect(finalized.status).toBe('finalized');
    const prelims = emails.filter((item) => item.eventType === 'prelim_invoice');
    expect(prelims).toHaveLength(1);
    expect(prelims[0]?.to).toBe(DEFAULT_CUSTOMERS[0].email);
    const locked = (await service.lockDeal(created.id, finance, approved.version)) as {
      version: number;
      customerEmails: Array<{ eventType: string; status: string; payload: { payableAmount: number } }>;
    };
    expect(emails.filter((item) => item.eventType === 'final_invoice')).toHaveLength(1);
    expect(locked.customerEmails.filter((item) => item.eventType === 'prelim_invoice')).toHaveLength(1);
    expect(locked.customerEmails.some((item) => item.eventType === 'final_invoice' && item.status === 'not_configured')).toBe(
      true,
    );
    await service.lockDeal(created.id, finance, locked.version);
    expect(emails.filter((item) => item.eventType === 'final_invoice')).toHaveLength(1);
  });

  it('persists one customer request, blocks duplicate submit, and withholds requested discount', async () => {
    const { service } = createService();
    const created = (await service.createQuote(
      {
        customerId: DEFAULT_CUSTOMERS[0].id,
        lines: [{ productId: DEFAULT_PRODUCTS[0].id, quantity: 8, discountPercent: 0 }],
      },
      staff,
    )) as {
      id: string;
      version: number;
      portalToken: string;
      lines: Array<{ id: string; discountPercent: number; quantity: number }>;
    };
    const submitted = (await service.createPortalNegotiation(created.portalToken, {
      expectedVersion: created.version,
      note: 'Requesting 8% discount for increasing quantity to 20.',
      requestedDiscountPercent: 8,
      requestedLines: [
        {
          lineId: created.lines[0].id,
          quantity: 20,
          discountPercent: 8,
          action: 'update',
          requestType: 'discount',
          comment: 'Volume increase',
          originalQuantity: 8,
          originalDiscountPercent: 0,
        },
      ],
    })) as {
      status: string;
      version: number;
      lines: Array<{ quantity: number; discountPercent: number }>;
      negotiations: Array<{
        id: string;
        status: string;
        requestedDiscountPercent?: number | null;
        requestedLines: Array<{ comment?: string }>;
      }>;
    };
    expect(submitted.status).toBe('customer_negotiation');
    expect(submitted.lines[0]?.quantity).toBe(20);
    expect(submitted.lines[0]?.discountPercent).toBe(0);
    expect(submitted.negotiations).toHaveLength(1);
    expect(submitted.negotiations[0]?.requestedDiscountPercent).toBe(8);
    expect(submitted.negotiations[0]?.requestedLines[0]?.comment).toBe('Volume increase');

    await expect(
      service.createPortalNegotiation(created.portalToken, {
        expectedVersion: submitted.version,
        note: 'Duplicate',
        requestedDiscountPercent: 8,
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });

    await expect(
      service.agreeToFinal(created.id, { expectedVersion: submitted.version }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });

    await expect(
      service.updateLine(created.id, created.lines[0].id, { discountPercent: 8, expectedVersion: submitted.version }, staff),
    ).rejects.toMatchObject({ code: 'AUTHORIZATION_ERROR' });

    const withinCap = (await service.updateLine(
      created.id,
      created.lines[0].id,
      { discountPercent: 5, expectedVersion: submitted.version },
      staff,
    )) as { status: string; version: number };
    expect(withinCap.status).toBe('customer_negotiation');

    const responded = (await service.respondToNegotiation(
      created.id,
      submitted.negotiations[0].id,
      { expectedVersion: withinCap.version, decision: 'in_review', responseNote: 'Request forwarded to Sales Manager.' },
      staff,
    )) as { version: number; negotiations: Array<{ status: string; responseNote?: string | null }> };
    expect(responded.negotiations.some((item) => item.status === 'in_review')).toBe(true);
    expect(responded.negotiations.some((item) => item.responseNote === 'Request forwarded to Sales Manager.')).toBe(true);
  });

  it('deletes unused products and draft quotes, voids negotiation quotes, and refuses unsafe deletes', async () => {
    const { service, records } = createService();
    const officer: Actor = {
      ...staff,
      permissions: [...(staff.permissions ?? []), 'dealflow.catalog.products.write'],
    };

    const unused = await service.upsertProduct(
      {
        sku: 'HW-DEL-1',
        name: 'Disposable Gateway',
        category: 'hardware',
        listPrice: 100,
        cost: 40,
        billingType: 'one_time',
      },
      officer,
    );
    await expect(service.deleteProduct(unused.id, officer)).resolves.toEqual({ id: unused.id, deleted: true });
    expect(records.some((item) => item.action === 'catalog.product_deleted' && item.resourceId === unused.id)).toBe(true);

    const draft = (await service.createQuote(
      {
        customerId: DEFAULT_CUSTOMERS[0].id,
        lines: [{ productId: DEFAULT_PRODUCTS[0].id, quantity: 1, discountPercent: 0 }],
      },
      staff,
    )) as { id: string; version: number };

    await expect(service.deleteProduct(DEFAULT_PRODUCTS[0].id, officer)).rejects.toMatchObject({
      code: 'CONFLICT',
      message: 'Product is used on quotations. Archive it instead.',
    });

    await expect(service.deleteQuote(draft.id, staff, draft.version)).resolves.toEqual({ id: draft.id, deleted: true });
    expect(records.some((item) => item.action === 'quote.deleted' && item.resourceId === draft.id)).toBe(true);

    const negotiable = (await service.createQuote(
      {
        customerId: DEFAULT_CUSTOMERS[0].id,
        lines: [{ productId: DEFAULT_PRODUCTS[0].id, quantity: 1, discountPercent: 0 }],
      },
      staff,
    )) as { id: string };
    const opened = (await service.startNegotiation(negotiable.id, staff)) as { version: number };
    await expect(service.deleteQuote(negotiable.id, staff, opened.version)).rejects.toMatchObject({
      code: 'CONFLICT',
      message: 'This quotation cannot be deleted. Void it instead.',
    });
    const voided = (await service.voidQuote(negotiable.id, staff, opened.version)) as { status: string };
    expect(voided.status).toBe('rejected');
    expect(records.some((item) => item.action === 'quote.voided' && item.resourceId === negotiable.id)).toBe(true);

    const policy = await service.upsertPolicy(
      {
        name: 'Temporary policy',
        warningPercent: 2,
        approvalPercent: 4,
        rejectPercent: 20,
        maxMarginImpactPercent: 8,
        priority: 99,
      },
      director,
    );
    await expect(service.deletePolicy(policy.id, officer)).rejects.toMatchObject({ code: 'AUTHORIZATION_ERROR' });
    await expect(service.deletePolicy(policy.id, director)).resolves.toEqual({ id: policy.id, deleted: true });
    expect(records.some((item) => item.action === 'catalog.policy_deleted' && item.resourceId === policy.id)).toBe(true);

    const warehouse = (await service.catalog()).warehouses[0];
    await expect(service.deleteWarehouse(warehouse.id, officer)).rejects.toMatchObject({ code: 'AUTHORIZATION_ERROR' });
    const createdWarehouse = await service.upsertWarehouse(
      { name: 'Overflow DC', fulfillmentCostPerUnit: 12 },
      director,
    );
    expect(createdWarehouse.name).toBe('Overflow DC');
    const renamed = await service.upsertWarehouse(
      { id: createdWarehouse.id, name: 'Overflow DC East', fulfillmentCostPerUnit: 14 },
      director,
    );
    expect(renamed.name).toBe('Overflow DC East');
    await expect(service.deleteWarehouse(warehouse.id, director)).resolves.toEqual({ id: warehouse.id, deleted: true });
    expect(records.some((item) => item.action === 'catalog.warehouse_deleted' && item.resourceId === warehouse.id)).toBe(true);

    const createdCustomer = await service.upsertCustomer(
      { name: 'Contoso Retail', email: 'buying@contoso.example', tier: 'gold' },
      staff,
    );
    expect(createdCustomer.email).toBe('buying@contoso.example');
    const renamedCustomer = await service.upsertCustomer(
      { id: createdCustomer.id, name: 'Contoso Retail Ltd', email: 'buying@contoso.example', tier: 'gold' },
      staff,
    );
    expect(renamedCustomer.name).toBe('Contoso Retail Ltd');
    await expect(service.deleteCustomer(DEFAULT_CUSTOMERS[0].id, staff)).rejects.toMatchObject({
      code: 'CONFLICT',
      message: 'Customer is used on quotations and cannot be deleted. Edit the contact details instead.',
    });
    await expect(service.deleteCustomer(createdCustomer.id, staff)).resolves.toEqual({
      id: createdCustomer.id,
      deleted: true,
    });

    const createdRelation = await service.upsertRelation(
      {
        productId: DEFAULT_PRODUCTS[0].id,
        recommendedProductId: DEFAULT_PRODUCTS[1].id,
        kind: 'cross_sell',
        reason: 'Pairs with gateway installs',
      },
      director,
    );
    expect(createdRelation.kind).toBe('cross_sell');
    await expect(service.deleteRelation(createdRelation.id, officer)).rejects.toMatchObject({
      code: 'AUTHORIZATION_ERROR',
    });
    await expect(service.deleteRelation(createdRelation.id, director)).resolves.toEqual({
      id: createdRelation.id,
      deleted: true,
    });

    const stockRow = {
      warehouseId: createdWarehouse.id,
      productId: DEFAULT_PRODUCTS[1].id,
      quantityOnHand: 4,
      reserved: 0,
      incoming: 0,
    };
    await service.upsertStock(stockRow, officer);
    const afterDelete = await service.deleteStock(createdWarehouse.id, DEFAULT_PRODUCTS[1].id, officer);
    expect(afterDelete.some((item) => item.warehouseId === createdWarehouse.id && item.productId === DEFAULT_PRODUCTS[1].id)).toBe(
      false,
    );
  });
});
