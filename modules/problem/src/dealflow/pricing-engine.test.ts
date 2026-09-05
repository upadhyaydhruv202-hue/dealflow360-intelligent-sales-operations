import { describe, expect, it } from 'vitest';

import { DEFAULT_PRODUCTS, DEFAULT_QUANTITY_BREAKS } from './defaults';
import { resolveUnitPrice } from './pricing-engine';

describe('quantity-based pricing', () => {
  const product = DEFAULT_PRODUCTS[0];

  it('keeps list price for 1–9 Core Gateway units', () => {
    expect(resolveUnitPrice({ product, quantity: 9, breaks: DEFAULT_QUANTITY_BREAKS }).unitPrice).toBe(4000);
    expect(resolveUnitPrice({ product, quantity: 8, breaks: DEFAULT_QUANTITY_BREAKS }).ruleName).toContain('1–9');
  });

  it('applies the 10–49 volume price when quantity crosses 10', () => {
    const nine = resolveUnitPrice({ product, quantity: 9, breaks: DEFAULT_QUANTITY_BREAKS });
    const ten = resolveUnitPrice({ product, quantity: 10, breaks: DEFAULT_QUANTITY_BREAKS });
    expect(nine.unitPrice).toBe(4000);
    expect(ten.unitPrice).toBe(3700);
    expect(ten.ruleName).toContain('10–49');
  });

  it('applies contract price from 50 units and ignores inactive breaks', () => {
    const prices = [1, 8, 9, 10, 49, 50, 51].map(
      (quantity) => resolveUnitPrice({ product, quantity, breaks: DEFAULT_QUANTITY_BREAKS }).unitPrice,
    );
    expect(prices).toEqual([4000, 4000, 4000, 3700, 3700, 3400, 3400]);
    expect(
      resolveUnitPrice({
        product,
        quantity: 10,
        breaks: DEFAULT_QUANTITY_BREAKS.map((item) =>
          item.minQuantity === 10 ? { ...item, active: false } : item,
        ),
      }).unitPrice,
    ).toBe(4000);
  });

  it('uses list price when no break matches', () => {
    expect(resolveUnitPrice({ product: DEFAULT_PRODUCTS[2], quantity: 12, breaks: DEFAULT_QUANTITY_BREAKS }).unitPrice).toBe(
      2400,
    );
  });
});
