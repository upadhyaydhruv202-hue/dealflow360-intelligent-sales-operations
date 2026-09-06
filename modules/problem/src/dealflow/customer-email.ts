import { hybridCommercials } from './billing-engine';
import { lineNetAmount } from './tax-engine';
import type {
  QuoteAggregate,
  QuoteEmailDelivery,
  QuoteEmailDocument,
  QuoteEmailEvent,
  QuoteEmailLine,
} from './types';

export function customerQuoteEmailKey(
  quoteId: string,
  eventType: QuoteEmailEvent,
  stamp: string | number,
): string {
  return `dealflow:quote:${quoteId}:${eventType}:${stamp}`;
}

export function customerQuoteEmailStamp(aggregate: QuoteAggregate, eventType: QuoteEmailEvent): string {
  if (eventType === 'final_invoice') {
    return aggregate.quote.financeLockedAt ?? `v${aggregate.quote.version}`;
  }
  return 'prelim';
}

export function buildCustomerQuoteDocument(
  aggregate: QuoteAggregate,
  eventType: QuoteEmailEvent,
): QuoteEmailDocument {
  const taxTotal = aggregate.quote.taxTotal ?? 0;
  const commercials = hybridCommercials({
    lines: aggregate.lines,
    products: aggregate.products,
    taxTotal,
  });
  const grandTotal = aggregate.quote.netTotal + taxTotal;
  const financeLocked = Boolean(aggregate.quote.financeLockedAt) || eventType === 'final_invoice';
  return {
    kind: eventType,
    customerName: aggregate.customer.name,
    quoteNumber: aggregate.quote.number,
    quoteVersion: aggregate.quote.version,
    status: aggregate.quote.status,
    approvalStatus: customerApprovalStatus(aggregate, eventType),
    lines: aggregate.lines.map((line) => {
      const product = aggregate.products.find((item) => item.id === line.productId);
      return {
        sku: product?.sku ?? '',
        name: product?.name ?? 'Product',
        quantity: line.quantity,
        unitPrice: line.listPrice,
        discountPercent: line.discountPercent,
        lineNet: lineNetAmount(line),
        billingType: product?.billingType ?? 'one_time',
        billingFrequency: product?.billingFrequency ?? null,
      } satisfies QuoteEmailLine;
    }),
    listTotal: aggregate.quote.listTotal,
    discountTotal: aggregate.quote.discountTotal,
    taxTotal,
    netTotal: aggregate.quote.netTotal,
    grandTotal,
    payableAmount: commercials.dueToday,
    recurringMonthly: commercials.recurringMonthly,
    recurringAnnual: commercials.recurringAnnual,
    financeLocked,
  };
}

export function customerApprovalStatus(aggregate: QuoteAggregate, eventType: QuoteEmailEvent): string {
  if (eventType === 'final_invoice' || aggregate.quote.financeLockedAt) {
    return 'Finance Manager locked. This is the final commercial bill.';
  }
  if (aggregate.quote.status === 'approved') {
    return 'Manager approved. Awaiting Finance Manager approval and commercial lock.';
  }
  return 'Manager approved the negotiated quotation. Awaiting Finance Manager approval and commercial lock.';
}

export function renderCustomerQuoteEmail(document: QuoteEmailDocument): { subject: string; text: string; html: string } {
  const prelim = document.kind === 'prelim_invoice';
  const subject = prelim
    ? `Provisional quotation ${document.quoteNumber} — awaiting Finance lock`
    : `Final bill for ${document.quoteNumber}`;
  const heading = prelim ? 'Provisional quotation / raw invoice' : 'Final commercial bill';
  const message = prelim
    ? 'Your negotiated quotation has been approved by the Manager. This is a provisional invoice. It is awaiting final Finance Manager approval and commercial lock.'
    : 'The Finance Manager has approved and locked this deal. This is your final commercial bill.';
  const lines = document.lines
    .map(
      (line) =>
        `${line.sku} ${line.name}  qty ${line.quantity}  unit ${money(line.unitPrice)}  discount ${line.discountPercent}%  ${line.billingType}  ${money(line.lineNet)}`,
    )
    .join('\n');
  const recurring =
    document.recurringMonthly > 0 || document.recurringAnnual > 0
      ? `Recurring monthly ${money(document.recurringMonthly)}  Annual ${money(document.recurringAnnual)}`
      : 'No recurring subscription on this quotation.';
  const text = [
    heading,
    `Customer: ${document.customerName}`,
    `Reference: ${document.quoteNumber}  Version ${document.quoteVersion}`,
    `Status: ${document.status.replaceAll('_', ' ')}`,
    document.approvalStatus,
    '',
    message,
    '',
    'Lines',
    lines || 'No lines',
    '',
    `List ${money(document.listTotal)}  Discount ${money(document.discountTotal)}  Tax ${money(document.taxTotal)}`,
    `Net ${money(document.netTotal)}  Payable ${money(document.payableAmount)}`,
    recurring,
    prelim ? 'A customer-safe provisional document is attached.' : 'A customer-safe final bill is attached.',
  ].join('\n');

  const html = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;color:#1a1d23">
<h1 style="font-size:20px">${escapeHtml(heading)}</h1>
<p>${escapeHtml(message)}</p>
<p><strong>Customer:</strong> ${escapeHtml(document.customerName)}<br/>
<strong>Reference:</strong> ${escapeHtml(document.quoteNumber)} · Version ${document.quoteVersion}<br/>
<strong>Status:</strong> ${escapeHtml(document.status.replaceAll('_', ' '))}<br/>
<strong>Approval:</strong> ${escapeHtml(document.approvalStatus)}</p>
<table cellpadding="6" cellspacing="0" border="1" style="border-collapse:collapse;font-size:13px">
<tr><th>SKU</th><th>Product</th><th>Qty</th><th>Unit</th><th>Discount</th><th>Type</th><th>Net</th></tr>
${document.lines
  .map(
    (line) =>
      `<tr><td>${escapeHtml(line.sku)}</td><td>${escapeHtml(line.name)}</td><td>${line.quantity}</td><td>${money(line.unitPrice)}</td><td>${line.discountPercent}%</td><td>${escapeHtml(line.billingFrequency ?? line.billingType)}</td><td>${money(line.lineNet)}</td></tr>`,
  )
  .join('')}
</table>
<p>List ${money(document.listTotal)} · Discount ${money(document.discountTotal)} · Tax ${money(document.taxTotal)}<br/>
Net ${money(document.netTotal)} · <strong>Payable ${money(document.payableAmount)}</strong><br/>
${escapeHtml(recurring)}</p>
<p>A customer-safe ${prelim ? 'provisional quotation' : 'final bill'} is attached. Internal margin, risk, and staff approval details are omitted.</p>
</body></html>`;

  return { subject, text, html };
}

export function emailFilename(document: QuoteEmailDocument): string {
  const kind = document.kind === 'prelim_invoice' ? 'provisional' : 'final-bill';
  return `${document.quoteNumber}-${kind}-v${document.quoteVersion}.pdf`;
}

export function isInternalEmailField(key: string): boolean {
  return /margin|risk|approval.?chain|actorId|ownerId|audit|fulfillment|warehouse|reserved/i.test(key);
}

export function assertCustomerSafePayload(payload: QuoteEmailDocument): void {
  const walk = (value: unknown): void => {
    if (!value || typeof value !== 'object') return;
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (isInternalEmailField(key)) {
        throw new Error('Customer email payload included staff-only fields');
      }
      walk(nested);
    }
  };
  walk(payload);
}

function money(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function newQuoteEmailDelivery(
  input: Omit<QuoteEmailDelivery, 'createdAt' | 'updatedAt'> & { createdAt?: string; updatedAt?: string },
): QuoteEmailDelivery {
  const now = new Date().toISOString();
  return {
    ...input,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
  };
}
