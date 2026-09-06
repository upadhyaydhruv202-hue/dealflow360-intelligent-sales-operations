/**
 * Customer portal payload. Intentionally omits approvals, risk internals,
 * fulfillment, billing operations, revisions, and staff identifiers.
 */
export function toPortalView(quote: {
  id: string;
  number: string;
  status: string;
  version?: number;
  createdAt?: string;
  customerDecision?: string;
  taxTotal?: number;
  listTotal: number;
  discountTotal: number;
  netTotal: number;
  blendedDiscountPercent: number;
  recurringMonthly?: number;
  recurringAnnual?: number;
  commercials?: {
    oneTimeNet: number;
    recurringMonthly: number;
    recurringYearly: number;
    recurringAnnual: number;
    dueToday: number;
    taxTotal: number;
  };
  loyalty?: { tier: string; wonPurchaseCount: number; bonusPercent: number };
  negotiations?: unknown[];
  customer: { name: string };
  lines: Array<{
    id: string;
    quantity: number;
    listPrice: number;
    discountPercent: number;
    product?: { sku?: string; name?: string; billingType?: string | null; billingFrequency?: string | null; description?: string | null } | null;
  }>;
}) {
  return {
    id: quote.id,
    number: quote.number,
    status: quote.status,
    createdAt: quote.createdAt,
    listTotal: quote.listTotal,
    discountTotal: quote.discountTotal,
    netTotal: quote.netTotal,
    blendedDiscountPercent: quote.blendedDiscountPercent,
    version: quote.version ?? 1,
    taxTotal: quote.taxTotal ?? 0,
    grandTotal: quote.netTotal + (quote.taxTotal ?? 0),
    recurringMonthly: quote.recurringMonthly ?? quote.commercials?.recurringMonthly ?? 0,
    recurringAnnual: quote.recurringAnnual ?? quote.commercials?.recurringAnnual ?? 0,
    commercials: quote.commercials,
    loyalty: quote.loyalty,
    negotiations: quote.negotiations ?? [],
    customerDecision: quote.customerDecision ?? 'none',
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
            billingFrequency: line.product.billingFrequency ?? null,
            description: line.product.description ?? null,
          }
        : null,
    })),
  };
}
