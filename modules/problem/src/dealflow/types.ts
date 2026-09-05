export const CUSTOMER_TIERS = ['standard', 'silver', 'gold', 'strategic'] as const;
export type CustomerTier = (typeof CUSTOMER_TIERS)[number];

export const BILLING_TYPES = ['one_time', 'recurring'] as const;
export type BillingType = (typeof BILLING_TYPES)[number];

export const BILLING_FREQUENCIES = ['monthly', 'quarterly', 'yearly'] as const;
export type BillingFrequency = (typeof BILLING_FREQUENCIES)[number];

export const QUOTE_STATUSES = [
  'draft',
  'approval_required',
  'approved',
  'customer_negotiation',
  'confirmed',
  'fulfillment',
  'billing',
  'completed',
  'rejected',
] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const DISCOUNT_DECISIONS = ['allowed', 'warning', 'approval_required', 'rejected'] as const;
export type DiscountDecision = (typeof DISCOUNT_DECISIONS)[number];

export const APPROVAL_STATUSES = ['pending', 'approved', 'rejected', 'skipped', 'invalidated'] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export const BILLING_STATUSES = ['scheduled', 'invoiced', 'cancelled'] as const;
export type BillingStatus = (typeof BILLING_STATUSES)[number];

export const RELATION_KINDS = ['upsell', 'cross_sell'] as const;
export type RelationKind = (typeof RELATION_KINDS)[number];

export const APPROVAL_ROLE_KEYS = ['manager', 'finance', 'final'] as const;
export type ApprovalRoleKey = (typeof APPROVAL_ROLE_KEYS)[number];

export const CUSTOMER_DECISIONS = ['none', 'accepted', 'declined'] as const;
export type CustomerDecision = (typeof CUSTOMER_DECISIONS)[number];

export const ANOMALY_SEVERITIES = ['warning', 'critical'] as const;
export type AnomalySeverity = (typeof ANOMALY_SEVERITIES)[number];

export const ANOMALY_STATUSES = ['open', 'acknowledged', 'resolved', 'dismissed'] as const;
export type AnomalyStatus = (typeof ANOMALY_STATUSES)[number];

export interface DealHealthFactor {
  id: string;
  label: string;
  level: 'healthy' | 'warning' | 'critical';
  detail: string;
}

export interface DealHealth {
  score: number;
  status: 'healthy' | 'at_risk' | 'critical';
  stage: string;
  daysInStage: number;
  recommendedAction: string;
  explanation: string;
  factors: DealHealthFactor[];
  computedAt: string;
}

export interface DealflowAnomaly {
  id: string;
  type: string;
  severity: AnomalySeverity;
  entityType: string;
  entityId: string;
  quoteId?: string | null;
  description: string;
  status: AnomalyStatus;
  resolution?: string | null;
  resolverId?: string | null;
  detectedAt: string;
  updatedAt: string;
}

export interface Actor {
  id: string;
  email?: string;
  role?: string;
  roles?: string[];
  permissions?: string[];
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  tier: CustomerTier;
  odooPartnerId?: number | null;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  listPrice: number;
  cost: number;
  billingType: BillingType;
  billingFrequency?: BillingFrequency | null;
  taxable?: boolean;
  odooProductId?: number | null;
}

export interface ProductRelation {
  id: string;
  productId: string;
  recommendedProductId: string;
  kind: RelationKind;
  reason: string;
  promotion?: string | null;
  minQuantity: number;
}

export interface Warehouse {
  id: string;
  name: string;
  fulfillmentCostPerUnit: number;
  odooWarehouseId?: number | null;
}

export interface StockLevel {
  warehouseId: string;
  productId: string;
  quantityOnHand: number;
  reserved: number;
  incoming?: number;
}

export interface DiscountPolicy {
  id: string;
  name: string;
  customerTier?: CustomerTier | null;
  productCategory?: string | null;
  warningPercent: number;
  approvalPercent: number;
  rejectPercent: number;
  maxMarginImpactPercent: number;
  priority: number;
}

export type QuantityAdjustmentKind = 'fixed' | 'percent';
export type AuthorityExceedAction = 'allow' | 'approval' | 'block';

export interface QuantityBreak {
  id: string;
  name: string;
  productId: string;
  customerTier?: CustomerTier | null;
  minQuantity: number;
  maxQuantity?: number | null;
  adjustmentKind: QuantityAdjustmentKind;
  adjustmentValue: number;
  active?: boolean;
}

export interface RoleAuthority {
  roleKey: string;
  maxDiscountPercent: number;
  minMarginPercent: number;
  maxPriceOverridePercent: number;
  canNegotiate: boolean;
  exceedAction: AuthorityExceedAction;
}

export interface WarehouseAvailability {
  warehouseId: string;
  name: string;
  available: number;
}

export interface ApprovalChainStep {
  id: string;
  chainId: string;
  stepOrder: number;
  roleKey: ApprovalRoleKey;
  label: string;
}

export interface ApprovalChain {
  id: string;
  name: string;
  minRiskScore: number;
  minBlendedDiscountPercent: number;
  priority: number;
  steps: ApprovalChainStep[];
}

export interface QuoteLine {
  id: string;
  quoteId: string;
  productId: string;
  quantity: number;
  listPrice: number;
  discountPercent: number;
  unitCost: number;
  recommendedFromId?: string | null;
}

export interface Quote {
  id: string;
  number: string;
  customerId: string;
  ownerId?: string | null;
  status: QuoteStatus;
  listTotal: number;
  discountTotal: number;
  netTotal: number;
  costTotal: number;
  marginPercent: number;
  blendedDiscountPercent: number;
  riskScore: number;
  assessmentDecision: DiscountDecision;
  requiredChainId?: string | null;
  portalToken: string;
  version: number;
  odooSaleOrderId?: number | null;
  taxTotal: number;
  customerDecision: CustomerDecision;
  customerDecisionAt?: string | null;
  customerDecisionComment?: string | null;
  customerDecisionVersion?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface QuoteApproval {
  id: string;
  quoteId: string;
  chainId: string;
  stepOrder: number;
  roleKey: ApprovalRoleKey;
  label: string;
  status: ApprovalStatus;
  actorId?: string | null;
  decidedAt?: string | null;
  decision?: string | null;
  reason?: string | null;
  previousValues?: unknown;
  newValues?: unknown;
}

export interface FulfillmentSplit {
  id: string;
  quoteId: string;
  quoteLineId: string;
  warehouseId: string;
  quantity: number;
  unitFulfillmentCost: number;
  isBackorder: boolean;
  isManualOverride: boolean;
}

export interface Backorder {
  id: string;
  quoteId: string;
  productId: string;
  quantity: number;
}

export interface BillingSchedule {
  id: string;
  quoteId: string;
  quoteLineId: string;
  billingType: BillingType;
  frequency?: BillingFrequency | null;
  amount: number;
  status: BillingStatus;
  nextBillingAt?: string | null;
  cancelledAt?: string | null;
  prorationAmount: number;
  refundAmount: number;
  odooInvoiceId?: number | null;
}

export interface QuoteRevision {
  id: string;
  quoteId: string;
  version: number;
  snapshot: unknown;
  materialChange: boolean;
  createdBy?: string | null;
  createdAt: string;
}

export interface QuoteAggregate {
  quote: Quote;
  customer: Customer;
  lines: QuoteLine[];
  products: Product[];
  approvals: QuoteApproval[];
  allocations: FulfillmentSplit[];
  backorders: Backorder[];
  schedules: BillingSchedule[];
  revisions: QuoteRevision[];
}

export interface LineAssessment {
  productId: string;
  sku: string;
  quantity: number;
  discountPercent: number;
  listAmount: number;
  netAmount: number;
  costAmount: number;
  marginPercent: number;
  marginErosionPercent: number;
  policyId: string;
  policyName: string;
  decision: DiscountDecision;
  reasons: string[];
  basePrice?: number;
  appliedPrice?: number;
  pricingRuleName?: string;
  roleLimitExceeded?: boolean;
  approvalScope?: 'line' | 'quote';
  warehouses?: WarehouseAvailability[];
  totalAvailable?: number;
  shortfall?: number;
}

export interface QuoteAssessment {
  decision: DiscountDecision;
  blendedDiscountPercent: number;
  riskScore: number;
  listTotal: number;
  discountTotal: number;
  netTotal: number;
  costTotal: number;
  marginPercent: number;
  warningCount: number;
  approvalLineCount: number;
  rejectedCount: number;
  cumulativeEscalated: boolean;
  requiredChainId?: string | null;
  requiredChainName?: string | null;
  lines: LineAssessment[];
  reasons: string[];
  highValue?: boolean;
  mergeRisk?: boolean;
  mergeRiskReasons?: string[];
}

export interface FulfillmentPlan {
  allocations: FulfillmentSplit[];
  backorders: Backorder[];
  shipmentCount: number;
  fulfillmentCost: number;
  backorderQuantity: number;
}

export interface Recommendation {
  relationId: string;
  kind: RelationKind;
  product: Product;
  reason: string;
  promotion?: string | null;
  priceImpact: number;
  marginImpact: number;
}

export interface GovernanceConfig {
  cumulativeWarningLimit: number;
  materialDiscountDeltaPp: number;
  materialTotalDeltaRatio: number;
  highValueNetTotal: number;
  maxApprovalLevels: number;
  taxRatePercent: number;
  staleQuoteDays: number;
  unusualDiscountPercent: number;
  largeDealNetTotal: number;
}

export const DEFAULT_GOVERNANCE: GovernanceConfig = {
  cumulativeWarningLimit: 2,
  materialDiscountDeltaPp: 2,
  materialTotalDeltaRatio: 0.1,
  highValueNetTotal: 25_000,
  maxApprovalLevels: 3,
  taxRatePercent: 0,
  staleQuoteDays: 7,
  unusualDiscountPercent: 25,
  largeDealNetTotal: 50_000,
};

export const GOVERNANCE_CONFIG_ID = '99999999-9999-4999-8999-999999999901';

export const APPROVAL_PERMISSIONS: Record<ApprovalRoleKey, string> = {
  manager: 'dealflow.approvals.manager',
  finance: 'dealflow.approvals.finance',
  final: 'dealflow.approvals.final',
};
