/**
 * Customer portal payload. Intentionally omits approvals, risk internals,
 * fulfillment, billing operations, revisions, and staff identifiers.
 */
export function toPortalView(quote: {
  id: string;
  number: string;
  status: string;
  listTotal: number;
  discountTotal: number;
  netTotal: number;
  blendedDiscountPercent: number;
  customer: { name: string };
  lines: Array<{
    id: string;
    quantity: number;
    listPrice: number;
    discountPercent: number;
    product?: { sku?: string; name?: string; billingType?: string | null } | null;
  }>;
}) {
  return {
    id: quote.id,
    number: quote.number,
    status: quote.status,
    listTotal: quote.listTotal,
    discountTotal: quote.discountTotal,
    netTotal: quote.netTotal,
    blendedDiscountPercent: quote.blendedDiscountPercent,
    customer: { name: quote.customer.name },
    lines: quote.lines.map((line) => ({
      id: line.id,
      quantity: line.quantity,
      listPrice: line.listPrice,
      discountPercent: line.discountPercent,
      product: line.product
        ? {
            name: line.product.name ?? 'Product',
            sku: line.product.sku ?? '',
            billingType: line.product.billingType ?? null,
          }
        : null,
    })),
  };
}
