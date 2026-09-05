import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

import { lineNetAmount } from './tax-engine';
import type { Product, QuoteAggregate } from './types';

function money(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function billingLabel(product?: Product): string {
  if (!product) return 'one-time';
  if (product.billingType !== 'recurring') return 'one-time';
  return product.billingFrequency ?? 'recurring';
}

export async function renderCustomerQuotePdf(aggregate: QuoteAggregate, taxTotal: number): Promise<Buffer> {
  const quote = aggregate.quote;
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let y = 800;

  const line = (text: string, size = 11, useBold = false) => {
    page.drawText(text.slice(0, 110), {
      x: 48,
      y,
      size,
      font: useBold ? bold : font,
      color: rgb(0.1, 0.12, 0.16),
    });
    y -= size + 6;
  };

  line(`Quotation ${quote.number}`, 18, true);
  line(aggregate.customer.name, 12, true);
  line(`Status ${quote.status.replaceAll('_', ' ')} · Version ${quote.version} · ${quote.createdAt.slice(0, 10)}`);
  line('Validity: 30 days from issue unless superseded by a newer version.');
  y -= 8;
  line('Lines', 13, true);
  for (const item of aggregate.lines) {
    const product = aggregate.products.find((candidate) => candidate.id === item.productId);
    line(
      `${product?.sku ?? ''}  ${product?.name ?? 'Product'}  qty ${item.quantity}  ${money(item.listPrice)}  ${item.discountPercent}%  ${billingLabel(product)}  ${money(lineNetAmount(item))}`,
      9,
    );
  }
  const oneTime = aggregate.lines.reduce((sum, item) => {
    const product = aggregate.products.find((candidate) => candidate.id === item.productId);
    return product?.billingType === 'recurring' ? sum : sum + lineNetAmount(item);
  }, 0);
  const recurring = aggregate.lines.reduce((sum, item) => {
    const product = aggregate.products.find((candidate) => candidate.id === item.productId);
    return product?.billingType === 'recurring' ? sum + lineNetAmount(item) : sum;
  }, 0);
  y -= 8;
  line(`One-time ${money(oneTime)}  Recurring ${money(recurring)}  Tax ${money(taxTotal)}  Grand ${money(quote.netTotal + taxTotal)}`, 11, true);
  y -= 8;
  line('Customer copy. Internal margin, risk, approvals, fulfillment, and audit are omitted.', 9);
  line('Terms: prices are server-authoritative. Recurring amounts bill on the stated frequency after acceptance.', 9);
  return Buffer.from(await doc.save());
}
