import { invalid } from './errors';
import type { GovernanceConfig, QuantityBreak, RoleAuthority } from './types';

export function validateQuantityBreaks(items: readonly QuantityBreak[]): QuantityBreak[] {
  const normalized = items.map((item, index) => {
    if (!item.name?.trim()) {
      throw invalid('Quantity break name is required', { index });
    }
    if (!item.productId) {
      throw invalid('Quantity break product is required', { index, name: item.name });
    }
    if (!Number.isFinite(item.minQuantity) || item.minQuantity < 1) {
      throw invalid('Minimum quantity must be at least 1', { index, name: item.name });
    }
    if (item.maxQuantity != null && item.maxQuantity < item.minQuantity) {
      throw invalid('Minimum quantity cannot exceed maximum quantity', { index, name: item.name });
    }
    if (item.adjustmentKind !== 'fixed' && item.adjustmentKind !== 'percent') {
      throw invalid('Pricing mode must be fixed or percent', { index, name: item.name });
    }
    if (!Number.isFinite(item.adjustmentValue)) {
      throw invalid('Price or adjustment value is required', { index, name: item.name });
    }
    if (item.adjustmentKind === 'fixed' && item.adjustmentValue < 0) {
      throw invalid('Fixed price cannot be negative', { index, name: item.name });
    }
    if (item.adjustmentKind === 'percent' && (item.adjustmentValue < -100 || item.adjustmentValue > 100)) {
      throw invalid('Percent adjustment must be between -100 and 100', { index, name: item.name });
    }
    return {
      ...item,
      name: item.name.trim(),
      active: item.active !== false,
      maxQuantity: item.maxQuantity ?? null,
      customerTier: item.customerTier ?? null,
    };
  });

  const active = normalized.filter((item) => item.active);
  for (let i = 0; i < active.length; i += 1) {
    for (let j = i + 1; j < active.length; j += 1) {
      const left = active[i];
      const right = active[j];
      if (left.productId !== right.productId) continue;
      if ((left.customerTier ?? null) !== (right.customerTier ?? null)) continue;
      const leftMax = left.maxQuantity ?? Number.POSITIVE_INFINITY;
      const rightMax = right.maxQuantity ?? Number.POSITIVE_INFINITY;
      const overlaps = left.minQuantity <= rightMax && right.minQuantity <= leftMax;
      if (overlaps) {
        throw invalid('Active quantity ranges cannot overlap for the same product and customer', {
          left: left.name,
          right: right.name,
        });
      }
    }
  }

  return normalized;
}

export function validateRoleAuthorities(items: readonly RoleAuthority[]): RoleAuthority[] {
  const seen = new Set<string>();
  return items.map((item, index) => {
    const roleKey = item.roleKey?.trim();
    if (!roleKey) {
      throw invalid('Role key is required', { index });
    }
    if (seen.has(roleKey)) {
      throw invalid('Duplicate role rule', { roleKey });
    }
    seen.add(roleKey);
    if (item.maxDiscountPercent < 0 || item.maxDiscountPercent > 100) {
      throw invalid('Maximum discount must be between 0 and 100', { roleKey });
    }
    if (item.minMarginPercent < 0 || item.minMarginPercent > 100) {
      throw invalid('Minimum margin must be between 0 and 100', { roleKey });
    }
    if (item.maxPriceOverridePercent < 0 || item.maxPriceOverridePercent > 100) {
      throw invalid('Price override must be between 0 and 100', { roleKey });
    }
    if (!['allow', 'approval', 'block'].includes(item.exceedAction)) {
      throw invalid('Approval behavior must be allow, approval, or block', { roleKey });
    }
    return { ...item, roleKey };
  });
}

export function validateGovernance(input: GovernanceConfig): GovernanceConfig {
  if (!Number.isFinite(input.highValueNetTotal) || input.highValueNetTotal < 0) {
    throw invalid('High-value threshold must be zero or greater');
  }
  if (!Number.isInteger(input.maxApprovalLevels) || input.maxApprovalLevels < 1 || input.maxApprovalLevels > 3) {
    throw invalid('Approval levels must be an integer from 1 to 3');
  }
  if (!Number.isFinite(input.cumulativeWarningLimit) || input.cumulativeWarningLimit < 1) {
    throw invalid('Cumulative warning limit must be at least 1');
  }
  if (!Number.isFinite(input.materialDiscountDeltaPp) || input.materialDiscountDeltaPp < 0) {
    throw invalid('Material discount delta must be zero or greater');
  }
  if (!Number.isFinite(input.materialTotalDeltaRatio) || input.materialTotalDeltaRatio < 0 || input.materialTotalDeltaRatio > 1) {
    throw invalid('Material total ratio must be between 0 and 1');
  }
  if (!Number.isFinite(input.taxRatePercent) || input.taxRatePercent < 0 || input.taxRatePercent > 100) {
    throw invalid('Tax rate must be between 0 and 100');
  }
  if (!Number.isFinite(input.staleQuoteDays) || input.staleQuoteDays < 1) {
    throw invalid('Stale quote days must be at least 1');
  }
  if (!Number.isFinite(input.unusualDiscountPercent) || input.unusualDiscountPercent < 0 || input.unusualDiscountPercent > 100) {
    throw invalid('Unusual discount threshold must be between 0 and 100');
  }
  if (!Number.isFinite(input.largeDealNetTotal) || input.largeDealNetTotal < 0) {
    throw invalid('Large-deal threshold must be zero or greater');
  }
  if (
    !Number.isFinite(input.maxCommercialDiscountPercent) ||
    input.maxCommercialDiscountPercent < 0 ||
    input.maxCommercialDiscountPercent > 100
  ) {
    throw invalid('Maximum commercial discount must be between 0 and 100');
  }
  return { ...input, allowLoyaltyStacking: input.allowLoyaltyStacking !== false };
}
