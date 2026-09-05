import type { DealHealth, DealHealthFactor, GovernanceConfig, QuoteAggregate, QuoteAssessment } from './types';
import { DEFAULT_GOVERNANCE } from './types';

export function computeDealHealth(
  aggregate: QuoteAggregate,
  assessment: QuoteAssessment | undefined,
  config: GovernanceConfig = DEFAULT_GOVERNANCE,
  now = Date.now(),
): DealHealth {
  const quote = aggregate.quote;
  const factors: DealHealthFactor[] = [];
  let score = 100;
  const ageDays = Math.max(0, (now - Date.parse(quote.createdAt)) / 86_400_000);
  const staleDays = Math.max(0, (now - Date.parse(quote.updatedAt)) / 86_400_000);
  const pendingApprovals = aggregate.approvals.filter((item) => item.status === 'pending');
  const backorderQty = aggregate.backorders.reduce((sum, item) => sum + item.quantity, 0);

  if (quote.status === 'rejected' || quote.assessmentDecision === 'rejected') {
    score -= 40;
    factors.push({
      id: 'rejected',
      label: 'Rejected',
      level: 'critical',
      detail: 'Quote or assessment was rejected and needs a new commercial path.',
    });
  }
  if (quote.status === 'approval_required') {
    const delay = pendingApprovals.length > 0 && staleDays >= 3;
    score -= delay ? 28 : 20;
    factors.push({
      id: 'approval',
      label: 'Approval delay',
      level: delay ? 'critical' : 'warning',
      detail: delay
        ? `Approval has been pending for ${staleDays.toFixed(1)} days.`
        : `Waiting on ${assessment?.requiredChainName ?? 'an approval chain'}.`,
    });
  }
  if (quote.customerDecision === 'declined') {
    score -= 30;
    factors.push({
      id: 'declined',
      label: 'Customer declined',
      level: 'critical',
      detail: 'The customer declined this quotation version.',
    });
  } else if (quote.customerDecision === 'accepted') {
    factors.push({
      id: 'accepted',
      label: 'Customer accepted',
      level: 'healthy',
      detail: 'The customer accepted the current commercial terms.',
    });
  }
  if (quote.status === 'customer_negotiation') {
    score -= 10;
    factors.push({
      id: 'negotiation',
      label: 'Negotiation activity',
      level: 'warning',
      detail: 'Customer is negotiating quantity or discount on the isolated portal.',
    });
  }
  if (staleDays >= config.staleQuoteDays && quote.status !== 'completed' && quote.status !== 'rejected') {
    score -= 12;
    factors.push({
      id: 'stale',
      label: 'Stale activity',
      level: staleDays >= config.staleQuoteDays * 2 ? 'critical' : 'warning',
      detail: `Quote inactive for ${staleDays.toFixed(1)} days (threshold ${config.staleQuoteDays}).`,
    });
  }
  if (quote.blendedDiscountPercent >= config.unusualDiscountPercent) {
    score -= 16;
    factors.push({
      id: 'discount',
      label: 'Discount level',
      level: 'critical',
      detail: `Blended discount ${quote.blendedDiscountPercent.toFixed(1)}% exceeds the configured ${config.unusualDiscountPercent}% unusual-discount threshold.`,
    });
  } else if (quote.riskScore >= 40 || quote.assessmentDecision === 'warning' || quote.assessmentDecision === 'approval_required') {
    score -= quote.riskScore >= 70 ? 18 : 8;
    factors.push({
      id: 'discount',
      label: 'Discount risk',
      level: quote.riskScore >= 70 ? 'critical' : 'warning',
      detail: `Risk score ${quote.riskScore.toFixed(0)} with ${quote.blendedDiscountPercent.toFixed(1)}% blended discount.`,
    });
  }
  if (quote.marginPercent > 0 && quote.marginPercent < 30) {
    score -= 14;
    factors.push({
      id: 'margin',
      label: 'Margin risk',
      level: quote.marginPercent < 20 ? 'critical' : 'warning',
      detail: `Gross margin is ${quote.marginPercent.toFixed(1)}%.`,
    });
  }
  if (backorderQty > 0) {
    score -= 16;
    factors.push({
      id: 'fulfill',
      label: 'Fulfillment risk',
      level: 'warning',
      detail: `Backorder ${backorderQty} after available stock. Incoming stock is not treated as available.`,
    });
  }
  if (
    (quote.status === 'confirmed' || quote.status === 'fulfillment' || quote.status === 'billing') &&
    aggregate.schedules.length === 0
  ) {
    score -= 12;
    factors.push({
      id: 'billing',
      label: 'Billing risk',
      level: 'warning',
      detail: 'Confirmed commercial terms have no billing schedules yet.',
    });
  }
  if (quote.netTotal >= config.highValueNetTotal) {
    score -= 8;
    factors.push({
      id: 'high-value',
      label: 'High-value deal',
      level: 'warning',
      detail: `Net ${quote.netTotal.toFixed(0)} meets the high-value threshold ${config.highValueNetTotal}.`,
    });
  }
  if (ageDays >= 21 && quote.status === 'draft') {
    score -= 8;
    factors.push({
      id: 'age',
      label: 'Deal age',
      level: 'warning',
      detail: `Draft is ${ageDays.toFixed(1)} days old.`,
    });
  }

  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const status: DealHealth['status'] =
    clamped < 50 || quote.status === 'rejected' || quote.customerDecision === 'declined'
      ? 'critical'
      : clamped < 75
        ? 'at_risk'
        : 'healthy';
  const recommendedAction =
    status === 'critical'
      ? 'Reprice or re-open a governed path before the customer or warehouse moves.'
      : status === 'at_risk'
        ? 'Clear the listed blockers (approval, stock, or engagement) this week.'
        : 'Continue the current quote-to-cash path.';
  const explanation =
    factors.length > 0
      ? factors.map((factor) => factor.detail).join(' ')
      : 'No adverse commercial, approval, fulfillment, or engagement signals.';

  return {
    score: clamped,
    status,
    stage: quote.status.replaceAll('_', ' '),
    daysInStage: Number(staleDays.toFixed(1)),
    recommendedAction,
    explanation,
    factors,
    computedAt: new Date(now).toISOString(),
  };
}
