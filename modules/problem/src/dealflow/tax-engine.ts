import type { GovernanceConfig, Product, QuoteLine } from './types';
import { DEFAULT_GOVERNANCE } from './types';

export function lineNetAmount(line: QuoteLine): number {
  return line.listPrice * line.quantity * (1 - line.discountPercent / 100);
}

export function computeTaxTotal(
  lines: QuoteLine[],
  products: Product[],
  config: GovernanceConfig = DEFAULT_GOVERNANCE,
): number {
  const rate = Math.max(0, config.taxRatePercent || 0) / 100;
  if (rate === 0) {
    return 0;
  }
  const taxable = lines.reduce((sum, line) => {
    const product = products.find((item) => item.id === line.productId);
    if (product && product.taxable === false) {
      return sum;
    }
    return sum + lineNetAmount(line);
  }, 0);
  return Math.round(taxable * rate * 100) / 100;
}
