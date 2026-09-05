export type QuoteStatus =
  | 'draft'
  | 'approval_required'
  | 'approved'
  | 'customer_negotiation'
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
export type CustomerTier = 'standard' | 'silver' | 'gold' | 'strategic';

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
  product?: Product | null;
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
  createdAt: string;
  updatedAt: string;
  customer: Customer;
  lines: QuoteLine[];
  assessment?: QuoteAssessment;
  approvals: QuoteApproval[];
  fulfillment: QuoteFulfillment;
  billing: BillingSchedule[];
  revisions: QuoteRevision[];
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
