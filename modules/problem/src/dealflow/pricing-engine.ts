import type { Product, QuantityBreak } from './types';

function round(value: number, digits = 4): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function matchingQuantityBreaks(
  breaks: readonly QuantityBreak[],
  productId: string,
  customerTier?: string | null,
): QuantityBreak[] {
  return breaks.filter(
    (item) =>
      item.active !== false &&
      item.productId === productId &&
      (item.customerTier == null || item.customerTier === customerTier),
  );
}

export function selectQuantityBreak(
  breaks: readonly QuantityBreak[],
  productId: string,
  quantity: number,
  customerTier?: string | null,
): QuantityBreak | undefined {
  return matchingQuantityBreaks(breaks, productId, customerTier)
    .filter((item) => quantity >= item.minQuantity && (item.maxQuantity == null || quantity <= item.maxQuantity))
    .sort((left, right) => {
      const spec = (right.customerTier ? 1 : 0) - (left.customerTier ? 1 : 0);
      if (spec !== 0) return spec;
      return right.minQuantity - left.minQuantity;
    })[0];
}

export function resolveUnitPrice(input: {
  product: Product;
  quantity: number;
  breaks?: readonly QuantityBreak[];
  customerTier?: string | null;
}): { unitPrice: number; ruleName: string; breakId?: string } {
  const selected = selectQuantityBreak(input.breaks ?? [], input.product.id, input.quantity, input.customerTier);
  if (!selected) {
    return { unitPrice: input.product.listPrice, ruleName: 'List price' };
  }
  if (selected.adjustmentKind === 'percent') {
    return {
      unitPrice: round(input.product.listPrice * (1 + selected.adjustmentValue / 100), 2),
      ruleName: selected.name,
      breakId: selected.id,
    };
  }
  return { unitPrice: selected.adjustmentValue, ruleName: selected.name, breakId: selected.id };
}
