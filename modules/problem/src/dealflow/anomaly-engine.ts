import type { DealflowAnomaly, GovernanceConfig, QuoteAggregate, QuoteAssessment } from './types';
import { DEFAULT_GOVERNANCE } from './types';

export function detectQuoteAnomalies(
  aggregate: QuoteAggregate,
  assessment: QuoteAssessment | undefined,
  config: GovernanceConfig = DEFAULT_GOVERNANCE,
  now = new Date(),
): Array<Omit<DealflowAnomaly, 'id' | 'status' | 'resolution' | 'resolverId' | 'updatedAt'>> {
  const quote = aggregate.quote;
  const found: Array<Omit<DealflowAnomaly, 'id' | 'status' | 'resolution' | 'resolverId' | 'updatedAt'>> = [];
  const stamp = now.toISOString();
  const staleDays = Math.max(0, (now.getTime() - Date.parse(quote.updatedAt)) / 86_400_000);
  const approvalCycles = aggregate.revisions.filter((item) => item.materialChange).length;
  const qtyJump = aggregate.revisions.some((item) => item.materialChange);

  if (quote.blendedDiscountPercent >= config.unusualDiscountPercent) {
    found.push({
      type: 'unusual_discount',
      severity: 'critical',
      entityType: 'quote',
      entityId: quote.id,
      quoteId: quote.id,
      description: `${quote.number}: unusual blended discount ${quote.blendedDiscountPercent.toFixed(1)}% (threshold ${config.unusualDiscountPercent}%).`,
      detectedAt: stamp,
    });
  }
  if (quote.netTotal >= config.largeDealNetTotal) {
    found.push({
      type: 'large_deal',
      severity: 'warning',
      entityType: 'quote',
      entityId: quote.id,
      quoteId: quote.id,
      description: `${quote.number}: unusually large net ${quote.netTotal.toFixed(0)} (threshold ${config.largeDealNetTotal}).`,
      detectedAt: stamp,
    });
  }
  if (assessment?.reasons.some((reason) => reason.includes('Unit price override'))) {
    found.push({
      type: 'price_override',
      severity: 'warning',
      entityType: 'quote',
      entityId: quote.id,
      quoteId: quote.id,
      description: `${quote.number}: abnormal unit-price override requires governance review.`,
      detectedAt: stamp,
    });
  }
  if (approvalCycles >= 2 && quote.status === 'approval_required') {
    found.push({
      type: 'repeated_approval',
      severity: 'warning',
      entityType: 'quote',
      entityId: quote.id,
      quoteId: quote.id,
      description: `${quote.number}: repeated approval requests after ${approvalCycles} material revisions.`,
      detectedAt: stamp,
    });
  }
  if (qtyJump && quote.status === 'customer_negotiation') {
    found.push({
      type: 'negotiation_spike',
      severity: 'warning',
      entityType: 'quote',
      entityId: quote.id,
      quoteId: quote.id,
      description: `${quote.number}: unusual negotiation produced a material commercial change.`,
      detectedAt: stamp,
    });
  }
  if (staleDays >= config.staleQuoteDays && quote.status !== 'completed' && quote.status !== 'rejected') {
    found.push({
      type: 'stale_deal',
      severity: staleDays >= config.staleQuoteDays * 2 ? 'critical' : 'warning',
      entityType: 'quote',
      entityId: quote.id,
      quoteId: quote.id,
      description: `${quote.number}: stale for ${staleDays.toFixed(1)} days with no commercial movement.`,
      detectedAt: stamp,
    });
  }
  if (aggregate.backorders.reduce((sum, item) => sum + item.quantity, 0) > 0) {
    found.push({
      type: 'inventory_shortfall',
      severity: 'warning',
      entityType: 'quote',
      entityId: quote.id,
      quoteId: quote.id,
      description: `${quote.number}: inventory shortfall created a backorder.`,
      detectedAt: stamp,
    });
  }
  return found;
}
