import type { BadgeTone } from '@/ui';

import { OPEN_STATUSES } from './format';
import type { DealflowCatalog, Product, QuantityBreak, QuoteStatus, QuoteView, Recommendation, StockLevel } from './types';

export type HealthLevel = 'healthy' | 'warning' | 'critical';

export interface HealthFactor {
  id: string;
  label: string;
  level: HealthLevel;
  detail: string;
}

export interface DealHealthSummary {
  level: HealthLevel;
  score: number;
  stage: string;
  daysInStage: number;
  probability: number;
  factors: HealthFactor[];
}

export interface DealAnomaly {
  id: string;
  quoteId: string;
  quoteNumber: string;
  customerName: string;
  severity: HealthLevel;
  title: string;
  reason: string;
  impact: string;
  action: string;
  href: string;
}

export interface DealInsight {
  id: string;
  title: string;
  detail: string;
  href?: string;
  tone: 'info' | 'warning' | 'success';
}

export interface HybridCommercials {
  oneTimeNet: number;
  recurringMonthly: number;
  recurringYearly: number;
  discount: number;
  dueToday: number;
  mixed: boolean;
}

export type AnomalyDisposition = 'open' | 'resolved' | 'ignored';

const DISPOSITION_KEY = 'df.anomaly.disposition';
const PORTAL_INTENT_KEY = 'df.portal.intent';

export function hoursSince(value: string, now = Date.now()): number {
  const stamp = new Date(value).getTime();
  if (Number.isNaN(stamp)) return 0;
  return Math.max(0, (now - stamp) / 3_600_000);
}

export function daysSince(value: string, now = Date.now()): number {
  return hoursSince(value, now) / 24;
}

export function stageLabel(status: QuoteStatus): string {
  return status.replaceAll('_', ' ');
}

export function healthTone(level: HealthLevel): BadgeTone {
  if (level === 'critical') return 'danger';
  if (level === 'warning') return 'warning';
  return 'success';
}

export function summarizeDealHealth(quote: QuoteView, now = Date.now()): DealHealthSummary {
  if (quote.health) {
    return {
      level: quote.health.status === 'critical' ? 'critical' : quote.health.status === 'at_risk' ? 'warning' : 'healthy',
      score: quote.health.score,
      stage: quote.health.stage,
      daysInStage: quote.health.daysInStage,
      probability: winProbability(quote),
      factors: quote.health.factors,
    };
  }
  const factors: HealthFactor[] = [];
  let score = 100;

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
    score -= 20;
    factors.push({
      id: 'approval',
      label: 'Approval status',
      level: hoursSince(quote.updatedAt, now) >= 72 ? 'critical' : 'warning',
      detail: `Waiting on ${quote.assessment?.requiredChainName ?? 'an approval chain'}.`,
    });
  }
  if (quote.riskScore >= 70 || quote.assessmentDecision === 'approval_required') {
    score -= 18;
    factors.push({
      id: 'discount',
      label: 'Discount risk',
      level: quote.riskScore >= 70 ? 'critical' : 'warning',
      detail: `Risk score ${quote.riskScore.toFixed(0)} with ${quote.blendedDiscountPercent.toFixed(1)}% blended discount.`,
    });
  } else if (quote.riskScore >= 40 || quote.assessmentDecision === 'warning') {
    score -= 8;
    factors.push({
      id: 'discount',
      label: 'Discount risk',
      level: 'warning',
      detail: `Elevated risk score ${quote.riskScore.toFixed(0)}.`,
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
  if (quote.fulfillment.backorderQuantity > 0) {
    score -= 16;
    factors.push({
      id: 'fulfill',
      label: 'Fulfillment risk',
      level: 'warning',
      detail: `Backorder ${quote.fulfillment.backorderQuantity} after available stock.`,
    });
  }
  if (
    (quote.status === 'confirmed' || quote.status === 'fulfillment' || quote.status === 'billing') &&
    quote.billing.length === 0
  ) {
    score -= 12;
    factors.push({
      id: 'billing',
      label: 'Billing risk',
      level: 'warning',
      detail: 'Confirmed commercial terms have no billing schedules yet.',
    });
  }
  if (quote.status === 'customer_negotiation') {
    score -= 10;
    factors.push({
      id: 'engagement',
      label: 'Customer engagement',
      level: 'warning',
      detail: 'Customer is negotiating quantity or discount on the isolated portal.',
    });
  }
  if (quote.assessment?.highValue) {
    score -= 8;
    factors.push({
      id: 'high-value',
      label: 'High-value deal',
      level: 'warning',
      detail: 'Net total meets the configured high-value threshold. The configured chain applies; Admin is not auto-inserted.',
    });
  }
  if (quote.assessment?.mergeRisk) {
    score -= 6;
    factors.push({
      id: 'merge-risk',
      label: 'Approval merge risk',
      level: 'warning',
      detail: quote.assessment.mergeRiskReasons?.[0] ?? 'Multiple line-level approvals stay itemized so a merge cannot hide product risk.',
    });
  }

  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const level: HealthLevel =
    clamped < 50 ||
    quote.status === 'rejected' ||
    quote.assessmentDecision === 'rejected' ||
    (quote.riskScore >= 70 && quote.status === 'approval_required')
      ? 'critical'
      : clamped < 75
        ? 'warning'
        : 'healthy';

  return {
    level,
    score: clamped,
    stage: stageLabel(quote.status),
    daysInStage: Number(daysSince(quote.updatedAt, now).toFixed(1)),
    probability: winProbability(quote),
    factors,
  };
}

export function winProbability(quote: QuoteView): number {
  switch (quote.status) {
    case 'completed':
      return 100;
    case 'confirmed':
    case 'fulfillment':
    case 'billing':
      return 92;
    case 'approved':
      return 74;
    case 'customer_negotiation':
      return 56;
    case 'approval_required':
      return 42;
    case 'rejected':
      return 8;
    default:
      return 28;
  }
}

export function availableProductUnits(stock: StockLevel[] | undefined, productId: string): number {
  return (stock ?? [])
    .filter((row) => row.productId === productId)
    .reduce((sum, row) => sum + Math.max(0, row.quantityOnHand - row.reserved), 0);
}

export function previewUnitPrice(
  product: Product,
  quantity: number,
  breaks: QuantityBreak[] | undefined,
  customerTier?: string | null,
): { unitPrice: number; ruleName: string } {
  const selected = (breaks ?? [])
    .filter(
      (item) =>
        item.productId === product.id && (item.customerTier == null || item.customerTier === customerTier),
    )
    .filter((item) => quantity >= item.minQuantity && (item.maxQuantity == null || quantity <= item.maxQuantity))
    .sort((left, right) => {
      const spec = (right.customerTier ? 1 : 0) - (left.customerTier ? 1 : 0);
      if (spec !== 0) return spec;
      return right.minQuantity - left.minQuantity;
    })[0];
  if (!selected) {
    return { unitPrice: product.listPrice, ruleName: 'List price' };
  }
  if (selected.adjustmentKind === 'percent') {
    return {
      unitPrice: Math.round(product.listPrice * (1 + selected.adjustmentValue / 100) * 100) / 100,
      ruleName: selected.name,
    };
  }
  return { unitPrice: selected.adjustmentValue, ruleName: selected.name };
}

export function warehouseAvailability(
  catalog: DealflowCatalog | undefined,
  productId: string,
): Array<{ warehouseId: string; name: string; available: number; incoming: number }> {
  if (!catalog) return [];
  return catalog.warehouses.map((warehouse) => {
    const rows = catalog.stock.filter((row) => row.warehouseId === warehouse.id && row.productId === productId);
    return {
      warehouseId: warehouse.id,
      name: warehouse.name,
      available: rows.reduce((sum, row) => sum + Math.max(0, row.quantityOnHand - row.reserved), 0),
      incoming: rows.reduce((sum, row) => sum + Math.max(0, row.incoming ?? 0), 0),
    };
  });
}

export function detectAnomalies(
  quotes: QuoteView[],
  catalog?: DealflowCatalog,
  now = Date.now(),
): DealAnomaly[] {
  const items: DealAnomaly[] = [];
  for (const quote of quotes) {
    const customerName = quote.customer?.name ?? 'Customer';
    if (quote.blendedDiscountPercent >= 16) {
      items.push({
        id: `${quote.id}-discount`,
        quoteId: quote.id,
        quoteNumber: quote.number,
        customerName,
        severity: quote.blendedDiscountPercent >= 20 ? 'critical' : 'warning',
        title: 'Discount above typical policy ceiling',
        reason: `Blended discount ${quote.blendedDiscountPercent.toFixed(1)}% is well above the seeded 5% approval ceiling for standard hardware.`,
        impact: `${quote.discountTotal.toFixed(0)} list dollars given as discount`,
        action: 'Review the risk panel and required chain',
        href: `/dealflow/quotes/${quote.id}?tab=risk`,
      });
    }
    if (quote.marginPercent > 0 && quote.marginPercent < 30) {
      items.push({
        id: `${quote.id}-margin`,
        quoteId: quote.id,
        quoteNumber: quote.number,
        customerName,
        severity: quote.marginPercent < 20 ? 'critical' : 'warning',
        title: 'Deal margin dropped below the 30% watch threshold',
        reason: `Current margin is ${quote.marginPercent.toFixed(1)}% after the requested discount.`,
        impact: `Net ${quote.netTotal.toFixed(0)} on cost ${quote.costTotal.toFixed(0)}`,
        action: 'Tighten discount or attach a higher-margin add-on',
        href: `/dealflow/quotes/${quote.id}?tab=risk`,
      });
    }
    if (quote.status === 'approval_required' && hoursSince(quote.updatedAt, now) >= 24) {
      const hours = Math.round(hoursSince(quote.updatedAt, now));
      items.push({
        id: `${quote.id}-sla`,
        quoteId: quote.id,
        quoteNumber: quote.number,
        customerName,
        severity: hours >= 72 ? 'critical' : 'warning',
        title: `Quotation has remained unapproved for ${hours} hours`,
        reason: `The current step is still pending on ${quote.assessment?.requiredChainName ?? 'the approval chain'}.`,
        impact: `${quote.netTotal.toFixed(0)} open value is blocked`,
        action: 'Open the approval center',
        href: `/dealflow/approvals`,
      });
    }
    for (const line of quote.lines) {
      const available = availableProductUnits(catalog?.stock, line.productId);
      if (available > 0 && line.quantity > available) {
        items.push({
          id: `${quote.id}-stock-${line.id}`,
          quoteId: quote.id,
          quoteNumber: quote.number,
          customerName,
          severity: 'warning',
          title: 'Requested quantity exceeds warehouse availability',
          reason: `${line.product?.name ?? 'Product'} qty ${line.quantity} vs ${available} available (on-hand minus reserved).`,
          impact: `Backorder risk ${line.quantity - available}`,
          action: 'Plan a multi-warehouse split',
          href: `/dealflow/quotes/${quote.id}?tab=fulfillment`,
        });
      }
    }
    if (
      (quote.status === 'confirmed' || quote.status === 'fulfillment' || quote.status === 'billing') &&
      quote.billing.length === 0
    ) {
      items.push({
        id: `${quote.id}-billing`,
        quoteId: quote.id,
        quoteNumber: quote.number,
        customerName,
        severity: 'warning',
        title: 'Confirmed quote has no hybrid billing schedules',
        reason: 'One-time and recurring products are on the quote, but generate billing has not run.',
        impact: 'Revenue recognition is incomplete for this deal',
        action: 'Generate billing',
        href: `/dealflow/quotes/${quote.id}?tab=billing`,
      });
    }
  }
  const rank = { critical: 0, warning: 1, healthy: 2 };
  return items.sort((left, right) => rank[left.severity] - rank[right.severity]);
}

export function contextualInsights(
  quote: QuoteView,
  catalog?: DealflowCatalog,
  recommendations: Recommendation[] = [],
): DealInsight[] {
  const insights: DealInsight[] = [];
  const health = summarizeDealHealth(quote);

  if (quote.status === 'approval_required') {
    insights.push({
      id: 'pending-approval',
      title: 'Deal health decreased because approval is still pending.',
      detail: `${quote.assessment?.requiredChainName ?? 'The required chain'} must finish before staff can confirm. Risk score ${quote.riskScore.toFixed(0)}.`,
      href: `/dealflow/quotes/${quote.id}?tab=approvals`,
      tone: 'warning',
    });
  }

  for (const line of quote.assessment?.lines ?? []) {
    if (line.decision === 'approval_required' || line.decision === 'rejected') {
      insights.push({
        id: `line-${line.sku}`,
        title: `${line.sku} at ${line.discountPercent}% needs governance.`,
        detail: line.reasons[0] ?? `${line.policyName} routed this line to ${line.decision.replaceAll('_', ' ')}.`,
        href: `/dealflow/quotes/${quote.id}?tab=risk`,
        tone: line.decision === 'rejected' ? 'warning' : 'info',
      });
    }
  }

  if ((quote.assessment?.approvalLineCount ?? 0) >= 2) {
    insights.push({
      id: 'cumulative',
      title: 'Two approval-required lines escalate quote risk.',
      detail: 'Cumulative warnings and approval lines select the longest seeded chain when risk reaches 70.',
      href: `/dealflow/quotes/${quote.id}?tab=risk`,
      tone: 'warning',
    });
  }

  for (const rec of recommendations) {
    insights.push({
      id: `rec-${rec.relationId}`,
      title: `Consider adding ${rec.product.name} as a ${rec.kind.replace('_', '-')}.`,
      detail: rec.reason,
      href: `/dealflow/quotes/${quote.id}?tab=lines`,
      tone: 'success',
    });
  }

  for (const line of quote.lines) {
    const available = availableProductUnits(catalog?.stock, line.productId);
    if (available > 0 && line.quantity > available) {
      insights.push({
        id: `stock-${line.id}`,
        title: `Increase cannot ship from one warehouse: ${line.product?.name ?? 'product'} qty ${line.quantity}.`,
        detail: `Available stock is ${available}. Accept the suggested split or reduce quantity.`,
        href: `/dealflow/quotes/${quote.id}?tab=fulfillment`,
        tone: 'warning',
      });
    }
  }

  for (const line of quote.assessment?.lines ?? []) {
    if (line.pricingRuleName && line.appliedPrice != null && line.basePrice != null && line.appliedPrice !== line.basePrice) {
      insights.push({
        id: `price-${line.sku}`,
        title: `Why did ${line.sku} price change?`,
        detail: `Quantity ${line.quantity} selected "${line.pricingRuleName}". Applied unit price is ${line.appliedPrice} instead of list ${line.basePrice}.`,
        href: `/dealflow/quotes/${quote.id}?tab=lines`,
        tone: 'info',
      });
    }
    if (line.roleLimitExceeded) {
      insights.push({
        id: `role-${line.sku}`,
        title: `Can I give this discount on ${line.sku}?`,
        detail:
          line.reasons.find((reason) => reason.includes('authorized range') || reason.includes('Unit price override')) ??
          'This change exceeds your role authority and requires approval.',
        href: `/dealflow/quotes/${quote.id}?tab=risk`,
        tone: 'warning',
      });
    }
    if ((line.shortfall ?? 0) > 0) {
      insights.push({
        id: `wh-${line.sku}`,
        title: `Which warehouse can fulfill ${line.sku}?`,
        detail: `${line.sku} needs ${line.quantity}; ${line.totalAvailable ?? 0} are available across warehouses (shortfall ${line.shortfall}). Use the existing split planner.`,
        href: `/dealflow/quotes/${quote.id}?tab=fulfillment`,
        tone: 'warning',
      });
    }
  }
  if (quote.assessment?.highValue) {
    insights.push({
      id: 'high-value',
      title: 'Can this quote be approved automatically?',
      detail: 'No. Net total meets the high-value threshold, so the configured chain must complete. Admin is not auto-added.',
      href: `/dealflow/quotes/${quote.id}?tab=approvals`,
      tone: 'warning',
    });
  }

  if (quote.blendedDiscountPercent >= 12 && quote.blendedDiscountPercent < 20) {
    insights.push({
      id: 'pricing-pressure',
      title: 'Competitor-style pricing pressure: blended discount is already in the finance-review band.',
      detail: 'Seeded Finance chain qualifies at 12% blended. A further 2 pp portal move is a material change.',
      href: `/dealflow/quotes/${quote.id}?tab=risk`,
      tone: 'info',
    });
  }

  if (health.level !== 'healthy') {
    insights.push({
      id: 'health',
      title: `${quote.number} is ${health.level} (${health.score}/100).`,
      detail: health.factors[0]?.detail ?? `Stage ${health.stage} · win probability ${health.probability}%.`,
      href: `/dealflow/health`,
      tone: health.level === 'critical' ? 'warning' : 'info',
    });
  }

  if (insights.length === 0) {
    insights.push({
      id: 'clear',
      title: 'No contextual exceptions on this quotation.',
      detail: 'Policy, stock, and billing look within the current seeded rules.',
      tone: 'success',
    });
  }

  return insights.slice(0, 6);
}

export function dashboardAnalytics(quotes: QuoteView[], now = Date.now()) {
  const open = quotes.filter((item) => OPEN_STATUSES.includes(item.status));
  const won = quotes.filter((item) =>
    ['confirmed', 'fulfillment', 'billing', 'completed'].includes(item.status),
  );
  const pending = quotes.filter((item) => item.status === 'approval_required');
  const openValue = open.reduce((sum, item) => sum + item.netTotal, 0);
  const wonValue = won.reduce((sum, item) => sum + item.netTotal, 0);
  const conversion = quotes.length ? (won.length / quotes.length) * 100 : 0;
  const forecast = open.reduce((sum, item) => sum + item.netTotal * (winProbability(item) / 100), 0);
  const oneTime = quotes.reduce((sum, quote) => sum + hybridCommercials(quote).oneTimeNet, 0);
  const recurring = quotes.reduce((sum, quote) => sum + hybridCommercials(quote).recurringMonthly, 0);
  const avgDiscount = quotes.length
    ? quotes.reduce((sum, item) => sum + item.blendedDiscountPercent, 0) / quotes.length
    : 0;
  const avgMargin = quotes.length ? quotes.reduce((sum, item) => sum + item.marginPercent, 0) / quotes.length : 0;
  return {
    open,
    won,
    pending,
    openValue,
    wonValue,
    conversion,
    forecast,
    oneTime,
    recurring,
    avgDiscount,
    avgMargin,
    agingApprovals: pending.filter((item) => hoursSince(item.updatedAt, now) >= 24).length,
  };
}

export function approvalPriority(quote: QuoteView, now = Date.now()): 'critical' | 'high' | 'normal' {
  const hours = hoursSince(quote.updatedAt, now);
  if (quote.riskScore >= 70 || hours >= 72) return 'critical';
  if (quote.riskScore >= 40 || hours >= 24 || quote.blendedDiscountPercent >= 16) return 'high';
  return 'normal';
}

export function approvalSlaLabel(quote: QuoteView, now = Date.now()): string {
  const hours = hoursSince(quote.updatedAt, now);
  if (hours >= 72) return `${Math.round(hours)}h · SLA breach`;
  if (hours >= 24) return `${Math.round(hours)}h · aging`;
  if (hours < 1) return '<1h in queue';
  return `${Math.round(hours)}h in queue`;
}

export function hybridCommercials(quote: QuoteView): HybridCommercials {
  let oneTimeNet = 0;
  let recurringMonthly = 0;
  let recurringYearly = 0;
  for (const line of quote.lines) {
    const list = line.listPrice * line.quantity;
    const net = list * (1 - line.discountPercent / 100);
    const type = line.product?.billingType;
    const frequency = line.product?.billingFrequency;
    if (type === 'recurring') {
      if (frequency === 'yearly') recurringYearly += net;
      else if (frequency === 'quarterly') recurringMonthly += net / 3;
      else recurringMonthly += net;
    } else {
      oneTimeNet += net;
    }
  }
  return {
    oneTimeNet,
    recurringMonthly,
    recurringYearly,
    discount: quote.discountTotal,
    dueToday: oneTimeNet + recurringMonthly + recurringYearly,
    mixed: oneTimeNet > 0 && (recurringMonthly > 0 || recurringYearly > 0),
  };
}

export function portalStatusLabel(status: QuoteStatus): string {
  switch (status) {
    case 'draft':
      return 'Draft';
    case 'approval_required':
      return 'In review';
    case 'approved':
      return 'Ready to accept';
    case 'customer_negotiation':
      return 'Negotiating';
    case 'rejected':
      return 'Returned';
    case 'confirmed':
    case 'fulfillment':
    case 'billing':
    case 'completed':
      return 'Accepted';
    default:
      return stageLabel(status);
  }
}

export function loadAnomalyDispositions(): Record<string, AnomalyDisposition> {
  if (typeof sessionStorage === 'undefined') return {};
  try {
    const raw = sessionStorage.getItem(DISPOSITION_KEY);
    return raw ? (JSON.parse(raw) as Record<string, AnomalyDisposition>) : {};
  } catch {
    return {};
  }
}

export function saveAnomalyDisposition(id: string, disposition: AnomalyDisposition): Record<string, AnomalyDisposition> {
  const next = { ...loadAnomalyDispositions(), [id]: disposition };
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem(DISPOSITION_KEY, JSON.stringify(next));
  }
  return next;
}

export type PortalIntent = 'accepted' | 'declined';

export function loadPortalIntent(token: string): PortalIntent | undefined {
  if (typeof sessionStorage === 'undefined') return undefined;
  try {
    const raw = sessionStorage.getItem(`${PORTAL_INTENT_KEY}.${token}`);
    return raw === 'accepted' || raw === 'declined' ? raw : undefined;
  } catch {
    return undefined;
  }
}

export function savePortalIntent(token: string, intent: PortalIntent): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(`${PORTAL_INTENT_KEY}.${token}`, intent);
}
