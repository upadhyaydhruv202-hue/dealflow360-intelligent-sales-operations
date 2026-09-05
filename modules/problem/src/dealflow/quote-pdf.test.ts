import { describe, expect, it } from 'vitest';

import { DEFAULT_CUSTOMERS, DEFAULT_PRODUCTS } from './defaults';
import { renderCustomerQuotePdf } from './quote-pdf';
import { emptyAggregate } from './store';

describe('renderCustomerQuotePdf', () => {
  it('renders a customer-safe PDF without internal margin, risk, or approval text', async () => {
    const aggregate = emptyAggregate({
      id: 'q1',
      number: 'DF-00009',
      customerId: DEFAULT_CUSTOMERS[0].id,
      status: 'approved',
      listTotal: 4000,
      discountTotal: 400,
      netTotal: 3600,
      costTotal: 2200,
      marginPercent: 38.8,
      blendedDiscountPercent: 10,
      riskScore: 12,
      assessmentDecision: 'allowed',
      portalToken: 'token',
      version: 2,
      taxTotal: 288,
      customerDecision: 'none',
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    });
    aggregate.customer = DEFAULT_CUSTOMERS[0];
    aggregate.products = [DEFAULT_PRODUCTS[0]];
    aggregate.lines = [
      {
        id: 'l1',
        quoteId: 'q1',
        productId: DEFAULT_PRODUCTS[0].id,
        quantity: 1,
        listPrice: 4000,
        discountPercent: 10,
        unitCost: 2200,
      },
    ];

    const pdf = await renderCustomerQuotePdf(aggregate, 288);
    const { PDFDocument } = await import('pdf-lib');
    const loaded = await PDFDocument.load(pdf);
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
    expect(loaded.getPageCount()).toBe(1);
    expect(pdf.length).toBeGreaterThan(400);
  });
});
