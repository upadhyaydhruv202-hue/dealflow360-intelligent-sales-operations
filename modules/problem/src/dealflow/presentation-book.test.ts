import { describe, expect, it } from 'vitest';

import { DEFAULT_CUSTOMERS, DEFAULT_PRODUCTS, DEFAULT_WAREHOUSES } from './defaults';
import {
  assertPresentationIntegrity,
  buildPresentationBook,
  countPresentationRecords,
  PRESENTATION_PORTAL_TOKEN,
  PRESENTATION_QUOTE_ID,
} from './presentation-book';

const ORDER_STATUSES = new Set(['confirmed', 'fulfillment', 'billing', 'completed']);
const FORBIDDEN = /\b(demo|test|sample)\b/i;
const ALLOWED_LABELS = new Set([
  PRESENTATION_PORTAL_TOKEN,
  ...DEFAULT_CUSTOMERS.map((item) => item.email),
]);

describe('presentation book', () => {
  const book = buildPresentationBook();
  const counts = countPresentationRecords(book);

  it('stays between 250 and 400 unique records with valid relationships', () => {
    assertPresentationIntegrity(book);
    expect(counts.total).toBeGreaterThanOrEqual(250);
    expect(counts.total).toBeLessThanOrEqual(400);
    expect(counts.breakdown.customers).toBeGreaterThanOrEqual(40);
    expect(counts.breakdown.customers).toBeLessThanOrEqual(60);
    expect(counts.breakdown.contacts).toBeGreaterThanOrEqual(50);
    expect(counts.breakdown.contacts).toBeLessThanOrEqual(70);
    expect(counts.breakdown.products).toBeGreaterThanOrEqual(40);
    expect(counts.breakdown.products).toBeLessThanOrEqual(60);
    expect(counts.breakdown.deals).toBeGreaterThanOrEqual(35);
    expect(counts.breakdown.deals).toBeLessThanOrEqual(50);
    expect(counts.breakdown.quotations).toBeGreaterThanOrEqual(30);
    expect(counts.breakdown.quotations).toBeLessThanOrEqual(45);
    expect(counts.breakdown.orders).toBeGreaterThanOrEqual(25);
    expect(counts.breakdown.orders).toBeLessThanOrEqual(40);
    expect(counts.breakdown.invoices).toBeGreaterThanOrEqual(25);
    expect(counts.breakdown.invoices).toBeLessThanOrEqual(40);
    expect(counts.breakdown.warehouses).toBeGreaterThanOrEqual(5);
    expect(counts.breakdown.warehouses).toBeLessThanOrEqual(10);
    expect(counts.breakdown.stock).toBeGreaterThanOrEqual(30);
    expect(counts.breakdown.stock).toBeLessThanOrEqual(50);
    expect(counts.breakdown.policies + counts.breakdown.quantityBreaks).toBeGreaterThanOrEqual(10);
    expect(counts.breakdown.policies + counts.breakdown.quantityBreaks).toBeLessThanOrEqual(20);
    expect(counts.breakdown.chains + counts.breakdown.roleAuthorities).toBeGreaterThanOrEqual(10);
    expect(counts.breakdown.chains + counts.breakdown.roleAuthorities).toBeLessThanOrEqual(15);
    expect(counts.breakdown.subscriptions).toBeGreaterThanOrEqual(10);
    expect(counts.breakdown.subscriptions).toBeLessThanOrEqual(20);
  });

  it('keeps the Northwind golden-path quote and default catalog identities', () => {
    const northwind = book.quotes.find((item) => item.number === 'DF-00001');
    expect(northwind?.id).toBe(PRESENTATION_QUOTE_ID);
    expect(northwind?.portalToken).toBe(PRESENTATION_PORTAL_TOKEN);
    expect(northwind?.customerId).toBe(DEFAULT_CUSTOMERS[0].id);
    expect(northwind?.status).toBe('draft');
    expect(book.products.some((item) => item.id === DEFAULT_PRODUCTS[0].id && item.sku === 'HW-CORE-1')).toBe(true);
    expect(book.warehouses.some((item) => item.id === DEFAULT_WAREHOUSES[0].id && item.name === 'West DC')).toBe(true);
  });

  it('uses a mix of commercial statuses and does not expose generated labels', () => {
    const statuses = new Set(book.quotes.map((item) => item.status));
    expect(statuses.has('draft')).toBe(true);
    expect(statuses.has('approval_required')).toBe(true);
    expect(statuses.has('rejected')).toBe(true);
    expect(book.quotes.some((item) => ORDER_STATUSES.has(item.status))).toBe(true);
    expect(book.quotes.some((item) => item.riskScore >= 40)).toBe(true);
    expect(book.stock.some((item) => item.quantityOnHand === 0 && item.incoming > 0)).toBe(true);
    expect(book.stock.some((item) => item.reserved > 0)).toBe(true);
    expect(book.quotes.some((item) => item.backorders.length > 0)).toBe(true);
    expect(book.quotes.some((item) => item.schedules.some((row) => row.status === 'invoiced'))).toBe(true);
    expect(book.quotes.some((item) => item.schedules.some((row) => row.billingType === 'recurring'))).toBe(true);

    const labels = [
      ...book.customers.map((item) => item.name),
      ...book.products.map((item) => `${item.name} ${item.sku}`),
      ...book.warehouses.map((item) => item.name),
      ...book.policies.map((item) => item.name),
      ...book.chains.map((item) => item.name),
      ...book.quantityBreaks.map((item) => item.name),
      ...book.quotes.map((item) => item.number),
    ];
    for (const label of labels) {
      if (ALLOWED_LABELS.has(label)) continue;
      expect(label).not.toMatch(FORBIDDEN);
    }
  });
});
