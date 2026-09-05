import type {
  ApprovalChain,
  CustomerTier,
  DiscountDecision,
  DiscountPolicy,
  GovernanceConfig,
  LineAssessment,
  Product,
  QuoteAssessment,
  QuoteLine,
} from './types';
import { DEFAULT_GOVERNANCE } from './types';

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
        riskScore >= chain.minRiskScore || blendedDiscountPercent >= chain.minBlendedDiscountPercent,
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

export function assessQuote(input: {
  customerTier: CustomerTier;
  lines: Array<{ line: QuoteLine; product: Product }>;
  policies: readonly DiscountPolicy[];
  chains: readonly ApprovalChain[];
  config?: GovernanceConfig;
}): QuoteAssessment {
  const config = input.config ?? DEFAULT_GOVERNANCE;
  const lineResults: LineAssessment[] = [];

  let listTotal = 0;
  let netTotal = 0;
  let costTotal = 0;
  let warningCount = 0;
  let approvalLineCount = 0;
  let rejectedCount = 0;

  for (const { line, product } of input.lines) {
    const listAmount = round(product.listPrice * line.quantity);
    const netAmount = round(product.listPrice * (1 - line.discountPercent / 100) * line.quantity);
    const costAmount = round(product.cost * line.quantity);
    const standardMargin = (product.listPrice - product.cost) * line.quantity;
    const actualMargin = netAmount - costAmount;
    const marginPercent = netAmount === 0 ? 0 : round((actualMargin / netAmount) * 100, 2);
    const marginErosionPercent =
      standardMargin <= 0 ? (line.discountPercent > 0 ? 100 : 0) : round(((standardMargin - actualMargin) / standardMargin) * 100, 2);
    const policy = selectPolicy(input.policies, input.customerTier, product.category);
    const decided = decideLineDiscount({
      discountPercent: line.discountPercent,
      marginErosionPercent,
      policy,
    });

    if (decided.decision === 'warning') warningCount += 1;
    if (decided.decision === 'approval_required') approvalLineCount += 1;
    if (decided.decision === 'rejected') rejectedCount += 1;

    listTotal += listAmount;
    netTotal += netAmount;
    costTotal += costAmount;

    lineResults.push({
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
      decision: decided.decision,
      reasons: decided.reasons,
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
