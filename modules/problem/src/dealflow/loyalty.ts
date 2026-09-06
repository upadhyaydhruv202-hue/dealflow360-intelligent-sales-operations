import { forbidden } from './errors';
import type { Actor, CustomerTier, GovernanceConfig, RoleAuthority } from './types';

export const LOYALTY_TIERS = ['new', 'gold', 'platinum'] as const;
export type LoyaltyTier = (typeof LOYALTY_TIERS)[number];

const DISCOUNT_ROLE_KEYS = ['staff', 'manager', 'finance'] as const;

export function wonPurchaseCountToTier(count: number): LoyaltyTier {
  if (count >= 5) return 'platinum';
  if (count >= 2) return 'gold';
  return 'new';
}

export function loyaltyBonusPercent(tier: LoyaltyTier | CustomerTier | string | null | undefined): number {
  const normalized = normalizeCustomerTier(tier);
  if (normalized === 'platinum') return 10;
  if (normalized === 'gold') return 5;
  return 0;
}

export function normalizeCustomerTier(tier: string | null | undefined): LoyaltyTier {
  if (tier === 'gold') return 'gold';
  if (tier === 'platinum' || tier === 'strategic') return 'platinum';
  return 'new';
}

export function persistCustomerTier(tier: LoyaltyTier | CustomerTier | string | null | undefined): CustomerTier {
  const normalized = normalizeCustomerTier(tier);
  if (normalized === 'platinum') return 'platinum';
  if (normalized === 'gold') return 'gold';
  return 'standard';
}

export function actorDiscountRoles(actor?: Actor): string[] {
  return [actor?.role, ...(actor?.roles ?? [])].filter((item): item is string => Boolean(item));
}

export function matchDiscountAuthority(
  authorities: readonly RoleAuthority[] | undefined,
  actor?: Actor,
): RoleAuthority | undefined {
  if (!authorities?.length || !actor) return undefined;
  const keys = new Set(actorDiscountRoles(actor));
  const matched = authorities
    .filter((item) => keys.has(item.roleKey) && (DISCOUNT_ROLE_KEYS as readonly string[]).includes(item.roleKey))
    .sort((left, right) => right.maxDiscountPercent - left.maxDiscountPercent)[0];
  if (matched) return matched;
  if (keys.has('admin')) {
    return (
      authorities.find((item) => item.roleKey === 'finance') ?? {
        roleKey: 'finance',
        maxDiscountPercent: 15,
        minMarginPercent: 10,
        maxPriceOverridePercent: 15,
        canNegotiate: true,
        exceedAction: 'block',
      }
    );
  }
  return undefined;
}

export function actorDiscountCeiling(input: {
  authorities?: readonly RoleAuthority[];
  actor?: Actor;
  loyaltyTier: LoyaltyTier | CustomerTier | string;
  config: GovernanceConfig;
}): { roleMax: number; loyaltyBonus: number; ceiling: number; roleKey?: string } {
  const authority = matchDiscountAuthority(input.authorities, input.actor);
  const roleMax = authority?.maxDiscountPercent ?? 0;
  const loyaltyBonus = input.config.allowLoyaltyStacking === false ? 0 : loyaltyBonusPercent(input.loyaltyTier);
  const stacked = roleMax + loyaltyBonus;
  const cap = Number.isFinite(input.config.maxCommercialDiscountPercent)
    ? input.config.maxCommercialDiscountPercent
    : 25;
  return {
    roleMax,
    loyaltyBonus,
    ceiling: Math.min(cap, stacked),
    roleKey: authority?.roleKey,
  };
}

export function assertPriceOverrideWithinAuthority(
  rulePrice: number,
  appliedPrice: number,
  input: {
    authorities?: readonly RoleAuthority[];
    actor?: Actor;
  },
): void {
  const authority = matchDiscountAuthority(input.authorities, input.actor);
  const max = authority?.maxPriceOverridePercent ?? 0;
  const overridePercent = rulePrice === 0 ? 0 : (Math.abs(appliedPrice - rulePrice) / rulePrice) * 100;
  if (overridePercent - max > 1e-9) {
    throw forbidden(
      `Unit price override ${overridePercent.toFixed(2)}% exceeds the ${authority?.roleKey ?? 'actor'} ceiling of ${max}%.`,
      { overridePercent, max, roleKey: authority?.roleKey },
    );
  }
}

export function assertDiscountWithinAuthority(
  discountPercent: number,
  input: {
    authorities?: readonly RoleAuthority[];
    actor?: Actor;
    loyaltyTier: LoyaltyTier | CustomerTier | string;
    config: GovernanceConfig;
  },
): void {
  const { ceiling, roleMax, loyaltyBonus, roleKey } = actorDiscountCeiling(input);
  if (discountPercent - ceiling > 1e-9) {
    throw forbidden(
      `Requested discount ${discountPercent}% exceeds the ${roleKey ?? 'actor'} authority of ${ceiling}% (role ${roleMax}% + loyalty ${loyaltyBonus}%). Send the quotation to a Sales Manager.`,
      { discountPercent, ceiling, roleMax, loyaltyBonus, roleKey, approvalRequired: 'manager' },
    );
  }
}
