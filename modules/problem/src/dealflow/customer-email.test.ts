import { describe, expect, it } from 'vitest';

import {
  assertCustomerSafePayload,
  buildCustomerQuoteDocument,
  customerQuoteEmailKey,
  customerQuoteEmailStamp,
  renderCustomerQuoteEmail,
} from './customer-email';
import { DEFAULT_CUSTOMERS, DEFAULT_PRODUCTS } from './defaults';
import { emptyAggregate } from './store';

describe('customer quote emails', () => {
  it('builds a customer-safe provisional document from the quote aggregate', () => {
    const aggregate = emptyAggregate({
      id: 'q1',
      number: 'DF-00042',
      customerId: DEFAULT_CUSTOMERS[0].id,
      status: 'approved',
      listTotal: 4000,
      discountTotal: 200,
      netTotal: 3800,
      costTotal: 2200,
      marginPercent: 42,
      blendedDiscountPercent: 5,
      riskScore: 18,
      assessmentDecision: 'approval_required',
      portalToken: 'token',
      version: 4,
      taxTotal: 304,
      customerDecision: 'accepted',
      commerciallyFrozenAt: '2026-09-06T00:00:00.000Z',
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-06T00:00:00.000Z',
    });
    aggregate.customer = DEFAULT_CUSTOMERS[0];
    aggregate.products = [DEFAULT_PRODUCTS[0], DEFAULT_PRODUCTS[2]];
    aggregate.lines = [
      {
        id: 'l1',
        quoteId: 'q1',
        productId: DEFAULT_PRODUCTS[0].id,
        quantity: 8,
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
        discountPercent: 10,
        unitCost: 400,
      },
    ];

    const document = buildCustomerQuoteDocument(aggregate, 'prelim_invoice');
    expect(document.customerName).toBe(DEFAULT_CUSTOMERS[0].name);
    expect(document.quoteNumber).toBe('DF-00042');
    expect(document.lines).toHaveLength(2);
    expect(document.lines[0]?.quantity).toBe(8);
    expect(document.lines[0]?.unitPrice).toBe(4000);
    expect(document.lines[0]?.discountPercent).toBe(10);
    expect(document.taxTotal).toBe(304);
    expect(document.recurringMonthly).toBeGreaterThan(0);
    expect(document.approvalStatus).toMatch(/Finance Manager/);
    expect(document.financeLocked).toBe(false);
    expect(JSON.stringify(document)).not.toMatch(/marginPercent|riskScore|ownerId|actorId/);
    assertCustomerSafePayload(document);

    const email = renderCustomerQuoteEmail(document);
    expect(email.subject).toMatch(/Provisional/);
    expect(email.text).toMatch(/awaiting final Finance Manager/);
    expect(email.text).not.toMatch(/risk score|margin/i);
    expect(email.html).toContain(DEFAULT_CUSTOMERS[0].name);
  });

  it('renders a final bill after finance lock', () => {
    const aggregate = emptyAggregate({
      id: 'q1',
      number: 'DF-00042',
      customerId: DEFAULT_CUSTOMERS[0].id,
      status: 'confirmed',
      listTotal: 2400,
      discountTotal: 0,
      netTotal: 2400,
      costTotal: 400,
      marginPercent: 83,
      blendedDiscountPercent: 0,
      riskScore: 0,
      assessmentDecision: 'allowed',
      portalToken: 'token',
      version: 6,
      taxTotal: 0,
      customerDecision: 'accepted',
      financeLockedAt: '2026-09-06T01:00:00.000Z',
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-06T01:00:00.000Z',
    });
    aggregate.customer = DEFAULT_CUSTOMERS[0];
    aggregate.products = [DEFAULT_PRODUCTS[2]];
    aggregate.lines = [
      {
        id: 'l2',
        quoteId: 'q1',
        productId: DEFAULT_PRODUCTS[2].id,
        quantity: 1,
        listPrice: 2400,
        discountPercent: 0,
        unitCost: 400,
      },
    ];
    const document = buildCustomerQuoteDocument(aggregate, 'final_invoice');
    const email = renderCustomerQuoteEmail(document);
    expect(document.financeLocked).toBe(true);
    expect(document.payableAmount).toBeGreaterThan(0);
    expect(email.subject).toMatch(/Final bill/);
    expect(email.text).toMatch(/locked this deal/);
    expect(customerQuoteEmailKey('q1', 'final_invoice', document.quoteVersion)).toContain('final_invoice');
    expect(customerQuoteEmailStamp(aggregate, 'final_invoice')).toBe('2026-09-06T01:00:00.000Z');
    expect(customerQuoteEmailStamp(aggregate, 'prelim_invoice')).toBe('prelim');
  });
});
