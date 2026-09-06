export type QuoteStatus =
  | 'draft'
  | 'approval_required'
  | 'approved'
  | 'customer_negotiation'
  | 'manager_review'
  | 'finalized'
  | 'confirmed'
  | 'fulfillment'
  | 'billing'
  | 'completed'
  | 'rejected';

export type DiscountDecision = 'allowed' | 'warning' | 'approval_required' | 'rejected';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'skipped' | 'invalidated';
export type BillingType = 'one_time' | 'recurring';
export type BillingFrequency = 'monthly' | 'quarterly' | 'yearly';
export type BillingStatus = 'scheduled' | 'invoiced' | 'cancelled';
export type ApprovalRoleKey = 'manager' | 'finance' | 'final';
export type CustomerTier = 'standard' | 'silver' | 'gold' | 'strategic' | 'platinum' | 'new';

export interface NegotiationRequest {
  id: string;
  quoteId: string;
  customerId: string;
  actorId?: string | null;
  actorRole?: string | null;
  requestedDiscountPercent?: number | null;
  requestedTargetAmount?: number | null;
  requestedLines: Array<{
    productId?: string;
    lineId?: string;
    quantity?: number;
    discountPercent?: number;
    action?: 'add' | 'remove' | 'update';
    requestType?: 'question' | 'quantity_change' | 'product_change' | 'removal' | 'pricing' | 'discount' | 'general';
    comment?: string;
    originalQuantity?: number;
    originalDiscountPercent?: number;
  }>;
  note: string;
  quoteVersion?: number | null;
  responseNote?: string | null;
  respondedBy?: string | null;
  respondedAt?: string | null;
  status:
    | 'open'
    | 'in_review'
    | 'sent_to_manager'
    | 'manager_revised'
    | 'returned_to_customer'
    | 'accepted'
    | 'rejected'
    | 'resolved'
    | 'agreed'
    | 'withdrawn';
  createdAt: string;
  updatedAt: string;
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
  description?: string | null;
  taxCategory?: string | null;
  taxRatePercent?: number | null;
  active?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductRelation {
  id: string;
  productId: string;
  recommendedProductId: string;
  kind: 'upsell' | 'cross_sell';
  reason: string;
  promotion?: string | null;
  minQuantity: number;
}

export interface Warehouse {
  id: string;
  name: string;
  fulfillmentCostPerUnit: number;
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
  description?: string | null;
  active?: boolean;
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
  active?: boolean;
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
  product?: Product | null;
}

export interface WarehouseAvailability {
  warehouseId: string;
  name: string;
  available: number;
}

export interface QuantityBreak {
  id: string;
  name: string;
  productId: string;
  customerTier?: CustomerTier | null;
  minQuantity: number;
  maxQuantity?: number | null;
  adjustmentKind: 'fixed' | 'percent';
  adjustmentValue: number;
  active?: boolean;
}

export interface RoleAuthority {
  roleKey: string;
  maxDiscountPercent: number;
  minMarginPercent: number;
  maxPriceOverridePercent: number;
  canNegotiate: boolean;
  exceedAction: 'allow' | 'approval' | 'block';
}

export interface GovernanceSettings {
  cumulativeWarningLimit: number;
  materialDiscountDeltaPp: number;
  materialTotalDeltaRatio: number;
  highValueNetTotal: number;
  maxApprovalLevels: number;
  taxRatePercent?: number;
  staleQuoteDays?: number;
  unusualDiscountPercent?: number;
  largeDealNetTotal?: number;
  maxCommercialDiscountPercent?: number;
  allowLoyaltyStacking?: boolean;
}

export interface LineAssessment {
  lineId: string;
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

export interface QuoteFulfillment {
  allocations: FulfillmentSplit[];
  backorders: Backorder[];
  shipmentCount: number;
  fulfillmentCost: number;
  backorderQuantity: number;
}

export interface QuoteView {
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
  taxTotal?: number;
  grandTotal?: number;
  recurringMonthly?: number;
  recurringAnnual?: number;
  commercials?: {
    oneTimeNet: number;
    recurringMonthly: number;
    recurringYearly: number;
    recurringAnnual: number;
    dueToday: number;
    taxTotal: number;
  };
  loyalty?: { tier: string; wonPurchaseCount: number; bonusPercent: number };
  negotiations?: NegotiationRequest[];
  discountAuthority?: { roleMax: number; loyaltyBonus: number; ceiling: number; roleKey?: string };
  customerDecision?: 'none' | 'accepted' | 'declined';
  commerciallyFrozenAt?: string | null;
  financeLockedAt?: string | null;
  health?: {
    score: number;
    status: 'healthy' | 'at_risk' | 'critical';
    stage: string;
    daysInStage: number;
    recommendedAction: string;
    explanation: string;
    factors: Array<{ id: string; label: string; level: 'healthy' | 'warning' | 'critical'; detail: string }>;
    computedAt: string;
  };
  odooIntegration?: { configured: boolean; saleOrderId: number | null };
  createdAt: string;
  updatedAt: string;
  customer: Customer;
  lines: QuoteLine[];
  assessment?: QuoteAssessment;
  approvals: QuoteApproval[];
  fulfillment: QuoteFulfillment;
  billing: BillingSchedule[];
  revisions: QuoteRevision[];
  customerEmails?: QuoteEmailDelivery[];
}

export type QuoteEmailEvent = 'prelim_invoice' | 'final_invoice';
export type QuoteEmailStatus = 'pending' | 'not_configured' | 'sent' | 'failed';

export interface QuoteEmailDelivery {
  id: string;
  quoteId: string;
  eventType: QuoteEmailEvent;
  quoteVersion: number;
  recipientEmail: string;
  status: QuoteEmailStatus;
  errorMessage?: string | null;
  sentAt?: string | null;
  createdAt: string;
}

export interface CustomerQuote {
  id: string;
  number: string;
  status: QuoteStatus;
  listTotal: number;
  discountTotal: number;
  netTotal: number;
  blendedDiscountPercent: number;
  version: number;
  portalToken: string;
  customer: { name: string };
  lines: Array<{
    id: string;
    quantity: number;
    listPrice: number;
    discountPercent: number;
    product: { name: string; sku: string; billingType: BillingType | null } | null;
  }>;
}

export interface Recommendation {
  relationId: string;
  kind: 'upsell' | 'cross_sell';
  product: Product;
  reason: string;
  promotion?: string | null;
  priceImpact: number;
  marginImpact: number;
}

export interface DealflowCatalog {
  customers: Customer[];
  products: Product[];
  warehouses: Warehouse[];
  stock: StockLevel[];
  policies: DiscountPolicy[];
  chains: ApprovalChain[];
  relations?: ProductRelation[];
  quantityBreaks?: QuantityBreak[];
  roleAuthorities?: RoleAuthority[];
  governance?: GovernanceSettings;
}

export interface AuditEvent {
  id: string;
  actorId: string | null;
  action: string;
  resource: string | null;
  resourceId: string | null;
  timestamp: string;
  status: string;
  metadata?: unknown;
  oldValue?: unknown;
  newValue?: unknown;
}
