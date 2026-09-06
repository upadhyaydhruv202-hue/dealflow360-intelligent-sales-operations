import { resolveUnitPrice } from './pricing-engine';
import type {
  Actor,
  ApprovalChain,
  CustomerTier,
  DiscountDecision,
  DiscountPolicy,
  GovernanceConfig,
  LineAssessment,
  Product,
  QuantityBreak,
  QuoteAssessment,
  QuoteLine,
  RoleAuthority,
  StockLevel,
  Warehouse,
} from './types';
import { DEFAULT_GOVERNANCE } from './types';
import { matchDiscountAuthority, normalizeCustomerTier } from './loyalty';

function round(value: number, digits = 4): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function specificity(policy: DiscountPolicy): number {
  return (policy.customerTier ? 2 : 0) + (policy.productCategory ? 2 : 0);
}

export function selectPolicy(
  policies: readonly DiscountPolicy[],
  tier: CustomerTier,
  category: string,
): DiscountPolicy {
  const matches = policies.filter(
    (policy) =>
      policy.active !== false &&
      (policy.customerTier == null || policy.customerTier === tier) &&
      (policy.productCategory == null || policy.productCategory === category),
  );
  const ranked = [...matches].sort((left, right) => {
    const spec = specificity(right) - specificity(left);
    if (spec !== 0) {
      return spec;
    }
    return left.priority - right.priority;
  });
  if (ranked[0]) {
    return ranked[0];
  }
  return {
    id: 'implicit-default',
    name: 'Implicit default',
    warningPercent: 3,
    approvalPercent: 5,
    rejectPercent: 25,
    maxMarginImpactPercent: 40,
    priority: 999,
  };
}

export function decideLineDiscount(input: {
  discountPercent: number;
  marginErosionPercent: number;
  policy: DiscountPolicy;
}): { decision: DiscountDecision; reasons: string[] } {
  const reasons: string[] = [];
  let decision: DiscountDecision = 'allowed';

  if (input.discountPercent >= input.policy.rejectPercent) {
    decision = 'rejected';
    reasons.push(
      `Requested ${input.discountPercent}% exceeds reject ceiling ${input.policy.rejectPercent}% (${input.policy.name})`,
    );
  } else if (input.discountPercent >= input.policy.approvalPercent) {
    decision = 'approval_required';
    reasons.push(
      `Requested ${input.discountPercent}% exceeds approval ceiling ${input.policy.approvalPercent}% (${input.policy.name})`,
    );
  } else if (input.discountPercent >= input.policy.warningPercent) {
    decision = 'warning';
    reasons.push(
      `Requested ${input.discountPercent}% exceeds warning ceiling ${input.policy.warningPercent}% (${input.policy.name})`,
    );
  }

  if (input.marginErosionPercent >= input.policy.maxMarginImpactPercent) {
    reasons.push(
      `Margin erosion ${round(input.marginErosionPercent, 2)}% exceeds ${input.policy.maxMarginImpactPercent}% (${input.policy.name})`,
    );
    if (decision === 'allowed' || decision === 'warning') {
      decision = 'approval_required';
    }
  }

  if (decision === 'allowed') {
    reasons.push(`Within ${input.policy.name} ceilings`);
  }

  return { decision, reasons };
}

export function selectApprovalChain(
  chains: readonly ApprovalChain[],
  riskScore: number,
  blendedDiscountPercent: number,
): ApprovalChain | undefined {
  return [...chains]
    .filter(
      (chain) =>
        chain.active !== false &&
        (riskScore >= chain.minRiskScore || blendedDiscountPercent >= chain.minBlendedDiscountPercent),
    )
    .sort((left, right) => {
      const severity =
        right.minRiskScore + right.minBlendedDiscountPercent - (left.minRiskScore + left.minBlendedDiscountPercent);
      if (severity !== 0) {
        return severity;
      }
      return left.priority - right.priority;
    })[0];
}

const DECISION_RANK: Record<DiscountDecision, number> = {
  allowed: 0,
  warning: 1,
  approval_required: 2,
  rejected: 3,
};

function worse(left: DiscountDecision, right: DiscountDecision): DiscountDecision {
  return DECISION_RANK[left] >= DECISION_RANK[right] ? left : right;
}

export function selectRoleAuthority(
  authorities: readonly RoleAuthority[] | undefined,
  actor?: Actor,
): RoleAuthority | undefined {
  return matchDiscountAuthority(authorities, actor);
}

export function assessQuote(input: {
  customerTier: CustomerTier;
  lines: Array<{ line: QuoteLine; product: Product }>;
  policies: readonly DiscountPolicy[];
  chains: readonly ApprovalChain[];
  config?: GovernanceConfig;
  actor?: Actor;
  quantityBreaks?: readonly QuantityBreak[];
  roleAuthorities?: readonly RoleAuthority[];
  stock?: readonly StockLevel[];
  warehouses?: readonly Warehouse[];
}): QuoteAssessment {
  const config = input.config ?? DEFAULT_GOVERNANCE;
  const authority = selectRoleAuthority(input.roleAuthorities, input.actor);
  const customerTier = normalizeCustomerTier(input.customerTier) === 'new' ? 'standard' : normalizeCustomerTier(input.customerTier);
  const lineResults: LineAssessment[] = [];

  let listTotal = 0;
  let netTotal = 0;
  let costTotal = 0;
  let warningCount = 0;
  let approvalLineCount = 0;
  let rejectedCount = 0;

  for (const { line, product } of input.lines) {
    const priced = resolveUnitPrice({
      product,
      quantity: line.quantity,
      breaks: input.quantityBreaks,
      customerTier: customerTier as CustomerTier,
    });
    const rulePrice = priced.unitPrice;
    const appliedPrice = Math.abs(line.listPrice - rulePrice) > 0.005 ? line.listPrice : rulePrice;
    const overridePercent = rulePrice === 0 ? 0 : round((Math.abs(appliedPrice - rulePrice) / rulePrice) * 100, 2);
    const listAmount = round(appliedPrice * line.quantity);
    const netAmount = round(appliedPrice * (1 - line.discountPercent / 100) * line.quantity);
    const costAmount = round(product.cost * line.quantity);
    const standardMargin = (product.listPrice - product.cost) * line.quantity;
    const actualMargin = netAmount - costAmount;
    const marginPercent = netAmount === 0 ? 0 : round((actualMargin / netAmount) * 100, 2);
    const marginErosionPercent =
      standardMargin <= 0 ? (line.discountPercent > 0 ? 100 : 0) : round(((standardMargin - actualMargin) / standardMargin) * 100, 2);
    const policy = selectPolicy(input.policies, customerTier as CustomerTier, product.category);
    const decided = decideLineDiscount({
      discountPercent: line.discountPercent,
      marginErosionPercent,
      policy,
    });
    let decision = decided.decision;
    const reasons = [...decided.reasons];
    let roleLimitExceeded = false;

    if (authority && line.discountPercent > authority.maxDiscountPercent) {
      roleLimitExceeded = true;
      const message = `Requested ${line.discountPercent}% exceeds ${authority.roleKey} authorized range ${authority.maxDiscountPercent}%`;
      reasons.push(message);
      if (authority.exceedAction === 'block') {
        decision = 'rejected';
      } else if (authority.exceedAction === 'approval') {
        decision = worse(decision, 'approval_required');
      }
    }
    if (authority && marginPercent < authority.minMarginPercent && netAmount > 0) {
      reasons.push(
        `Margin ${marginPercent}% is below the ${authority.roleKey} floor of ${authority.minMarginPercent}%`,
      );
      if (authority.exceedAction === 'block') {
        decision = 'rejected';
      } else {
        decision = worse(decision, 'approval_required');
      }
    }
    if (authority && overridePercent > authority.maxPriceOverridePercent) {
      roleLimitExceeded = true;
      reasons.push(
        `Unit price override ${overridePercent}% exceeds ${authority.roleKey} authorized ${authority.maxPriceOverridePercent}%`,
      );
      if (authority.exceedAction === 'block') {
        decision = 'rejected';
      } else if (authority.exceedAction === 'approval') {
        decision = worse(decision, 'approval_required');
      }
    }

    const warehouses = (input.warehouses ?? []).map((warehouse) => {
      const row = input.stock?.find(
        (item) => item.warehouseId === warehouse.id && item.productId === product.id,
      );
      return {
        warehouseId: warehouse.id,
        name: warehouse.name,
        available: Math.max(0, (row?.quantityOnHand ?? 0) - (row?.reserved ?? 0)),
      };
    });
    const totalAvailable = warehouses.reduce((sum, item) => sum + item.available, 0);
    const shortfall = Math.max(0, line.quantity - totalAvailable);

    if (decision === 'warning') warningCount += 1;
    if (decision === 'approval_required') approvalLineCount += 1;
    if (decision === 'rejected') rejectedCount += 1;

    listTotal += listAmount;
    netTotal += netAmount;
    costTotal += costAmount;

    lineResults.push({
      lineId: line.id,
      productId: product.id,
      sku: product.sku,
      quantity: line.quantity,
      discountPercent: line.discountPercent,
      listAmount,
      netAmount,
      costAmount,
      marginPercent,
      marginErosionPercent,
      policyId: policy.id,
      policyName: policy.name,
      decision,
      reasons,
      basePrice: product.listPrice,
      appliedPrice,
      pricingRuleName: overridePercent > 0 ? `${priced.ruleName} · override` : priced.ruleName,
      roleLimitExceeded,
      approvalScope: decision === 'approval_required' || decision === 'rejected' ? 'line' : 'quote',
      warehouses,
      totalAvailable,
      shortfall,
    });
  }

  const discountTotal = round(listTotal - netTotal);
  const blendedDiscountPercent = listTotal === 0 ? 0 : round((discountTotal / listTotal) * 100, 2);
  const marginPercent = netTotal === 0 ? 0 : round(((netTotal - costTotal) / netTotal) * 100, 2);
  const cumulativeEscalated = warningCount >= config.cumulativeWarningLimit;
  const riskScore = round(
    clamp(
      blendedDiscountPercent * 2.5 +
        lineResults.reduce((sum, line) => sum + line.marginErosionPercent, 0) / Math.max(lineResults.length, 1) * 0.4 +
        warningCount * 8 +
        approvalLineCount * 15 +
        rejectedCount * 40,
      0,
      100,
    ),
    2,
  );

  let decision: DiscountDecision = 'allowed';
  for (const line of lineResults) {
    decision = worse(decision, line.decision);
  }
  if (decision !== 'rejected' && cumulativeEscalated) {
    decision = worse(decision, 'approval_required');
  }

  const reasons = [...lineResults.flatMap((line) => line.reasons)];
  if (cumulativeEscalated) {
    reasons.push(
      `${warningCount} warning-level lines reach the cumulative limit of ${config.cumulativeWarningLimit}`,
    );
  }

  const highValue = netTotal >= config.highValueNetTotal;
  if (highValue) {
    reasons.push(
      `High-value approval: net ${round(netTotal)} meets or exceeds the configured threshold ${config.highValueNetTotal}`,
    );
    if (decision !== 'rejected') {
      decision = worse(decision, 'approval_required');
    }
  }

  const lineApprovals = lineResults.filter((line) => line.approvalScope === 'line');
  const mergeRisk = lineApprovals.length >= 2;
  const mergeRiskReasons = mergeRisk
    ? [
        `Approval merge risk: ${lineApprovals.length} product lines each require review. They stay itemized on one quote chain so a product-specific risk is not hidden.`,
      ]
    : [];
  if (mergeRisk) {
    reasons.push(...mergeRiskReasons);
  }

  const chain =
    decision === 'approval_required' || decision === 'rejected'
      ? selectApprovalChain(input.chains, riskScore, blendedDiscountPercent)
      : undefined;
  if (chain) {
    reasons.push(`Approval chain "${chain.name}" selected (risk ${riskScore}, blended ${blendedDiscountPercent}%)`);
  }

  return {
    decision,
    blendedDiscountPercent,
    riskScore,
    listTotal: round(listTotal),
    discountTotal,
    netTotal: round(netTotal),
    costTotal: round(costTotal),
    marginPercent,
    warningCount,
    approvalLineCount,
    rejectedCount,
    cumulativeEscalated,
    requiredChainId: chain?.id ?? null,
    requiredChainName: chain?.name ?? null,
    lines: lineResults,
    reasons,
    highValue,
    mergeRisk,
    mergeRiskReasons,
  };
}

export function isMaterialChange(
  before: { blendedDiscountPercent: number; netTotal: number },
  after: { blendedDiscountPercent: number; netTotal: number },
  config: GovernanceConfig = DEFAULT_GOVERNANCE,
): boolean {
  const discountDelta = after.blendedDiscountPercent - before.blendedDiscountPercent;
  const totalDelta = before.netTotal === 0 ? after.netTotal : Math.abs(after.netTotal - before.netTotal) / before.netTotal;
  return discountDelta >= config.materialDiscountDeltaPp || totalDelta >= config.materialTotalDeltaRatio;
}
