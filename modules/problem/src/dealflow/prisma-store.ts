import { randomBytes } from 'node:crypto';

import {
  DEFAULT_QUANTITY_BREAKS,
  DEFAULT_ROLE_AUTHORITIES,
} from './defaults';
import type { DealflowStore } from './store';
import type {
  ApprovalChain,
  ApprovalRoleKey,
  BillingFrequency,
  BillingStatus,
  BillingType,
  Customer,
  CustomerTier,
  DiscountDecision,
  DiscountPolicy,
  FulfillmentSplit,
  GovernanceConfig,
  Product,
  ProductRelation,
  QuantityBreak,
  Quote,
  QuoteAggregate,
  QuoteApproval,
  QuoteLine,
  QuoteRevision,
  QuoteStatus,
  RelationKind,
  RoleAuthority,
  StockLevel,
  Warehouse,
  DealflowAnomaly,
  AnomalySeverity,
  AnomalyStatus,
  NegotiationRequest,
  NegotiationRequestedLine,
  NegotiationStatus,
  QuoteEmailDelivery,
  QuoteEmailDocument,
  QuoteEmailEvent,
  QuoteEmailStatus,
} from './types';
import { DEFAULT_GOVERNANCE, GOVERNANCE_CONFIG_ID } from './types';
import { persistCustomerTier } from './loyalty';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function uuidOrNull(value: string | null | undefined): string | null {
  return value && UUID_PATTERN.test(value) ? value : null;
}

type PrismaDelegate = {
  findMany: (args?: unknown) => Promise<unknown>;
  findUnique: (args?: unknown) => Promise<unknown>;
  create: (args?: unknown) => Promise<unknown>;
  update: (args?: unknown) => Promise<unknown>;
  upsert: (args?: unknown) => Promise<unknown>;
  delete?: (args?: unknown) => Promise<unknown>;
  deleteMany: (args?: unknown) => Promise<unknown>;
  count: (args?: unknown) => Promise<unknown>;
};

type PrismaLike = {
  dfCustomer: PrismaDelegate;
  dfProduct: PrismaDelegate;
  dfWarehouse: PrismaDelegate;
  dfStockLevel: PrismaDelegate;
  dfDiscountPolicy: PrismaDelegate;
  dfApprovalChain: PrismaDelegate;
  dfProductRelation: PrismaDelegate;
  dfQuantityBreak?: PrismaDelegate;
  dfRoleAuthority?: PrismaDelegate;
  dfGovernanceConfig?: PrismaDelegate;
  dfAnomaly?: PrismaDelegate;
  dfNegotiationRequest?: PrismaDelegate;
  dfQuoteEmailDelivery?: PrismaDelegate;
  quote: PrismaDelegate;
  quoteLine?: PrismaDelegate;
  quoteFulfillmentSplit?: PrismaDelegate;
  quoteApproval?: PrismaDelegate;
  quoteRevision: PrismaDelegate;
  $queryRawUnsafe?: (query: string, ...values: unknown[]) => Promise<unknown>;
  $executeRawUnsafe?: (query: string, ...values: unknown[]) => Promise<unknown>;
  $transaction: (fn: (tx: PrismaLike) => Promise<unknown>) => Promise<unknown>;
};

function field(row: Record<string, unknown>, camel: string, snake: string): unknown {
  return row[camel] ?? row[snake];
}

const quoteInclude = {
  customer: true,
  lines: true,
  approvals: true,
  allocations: true,
  backorders: true,
  schedules: true,
  revisions: true,
} as const;

function mapCustomer(row: Record<string, unknown>): Customer {
  return {
    id: String(row.id),
    name: String(row.name),
    email: String(row.email),
    tier: row.tier as CustomerTier,
    odooPartnerId: (row.odooPartnerId as number | null) ?? null,
  };
}

function mapProduct(row: Record<string, unknown>): Product {
  return {
    id: String(row.id),
    sku: String(row.sku),
    name: String(row.name),
    category: String(row.category),
    listPrice: Number(row.listPrice),
    cost: Number(row.cost),
    billingType: row.billingType as BillingType,
    billingFrequency: (row.billingFrequency as BillingFrequency | null) ?? null,
    description: (field(row, 'description', 'description') as string | null) ?? null,
    taxCategory: (field(row, 'taxCategory', 'tax_category') as string | null) ?? null,
    taxRatePercent: field(row, 'taxRatePercent', 'tax_rate_percent') != null
      ? Number(field(row, 'taxRatePercent', 'tax_rate_percent'))
      : null,
    active: field(row, 'active', 'active') !== false,
    taxable: row.taxable !== false,
    odooProductId: (row.odooProductId as number | null) ?? null,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt ? String(row.createdAt) : undefined,
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt ? String(row.updatedAt) : undefined,
  };
}

function mapQuote(row: Record<string, unknown>): Quote {
  return {
    id: String(row.id),
    number: String(row.number),
    customerId: String(row.customerId),
    ownerId: (row.ownerId as string | null) ?? null,
    status: row.status as QuoteStatus,
    listTotal: Number(row.listTotal),
    discountTotal: Number(row.discountTotal),
    netTotal: Number(row.netTotal),
    costTotal: Number(row.costTotal),
    marginPercent: Number(row.marginPercent),
    blendedDiscountPercent: Number(row.blendedDiscountPercent),
    riskScore: Number(row.riskScore),
    assessmentDecision: row.assessmentDecision as DiscountDecision,
    requiredChainId: (row.requiredChainId as string | null) ?? null,
    portalToken: String(row.portalToken),
    version: Number(row.version),
    odooSaleOrderId: (row.odooSaleOrderId as number | null) ?? null,
    taxTotal: Number(field(row, 'taxTotal', 'tax_total') ?? 0),
    customerDecision: ((field(row, 'customerDecision', 'customer_decision') as string | undefined) ?? 'none') as Quote['customerDecision'],
    customerDecisionAt: field(row, 'customerDecisionAt', 'customer_decision_at')
      ? new Date(field(row, 'customerDecisionAt', 'customer_decision_at') as Date).toISOString()
      : null,
    customerDecisionComment: (field(row, 'customerDecisionComment', 'customer_decision_comment') as string | null) ?? null,
    customerDecisionVersion: field(row, 'customerDecisionVersion', 'customer_decision_version')
      ? Number(field(row, 'customerDecisionVersion', 'customer_decision_version'))
      : null,
    commerciallyFrozenAt: field(row, 'commerciallyFrozenAt', 'commercially_frozen_at')
      ? new Date(field(row, 'commerciallyFrozenAt', 'commercially_frozen_at') as Date).toISOString()
      : null,
    commerciallyFrozenBy: (field(row, 'commerciallyFrozenBy', 'commercially_frozen_by') as string | null) ?? null,
    financeLockedAt: field(row, 'financeLockedAt', 'finance_locked_at')
      ? new Date(field(row, 'financeLockedAt', 'finance_locked_at') as Date).toISOString()
      : null,
    financeLockedBy: (field(row, 'financeLockedBy', 'finance_locked_by') as string | null) ?? null,
    activeNegotiationId: (field(row, 'activeNegotiationId', 'active_negotiation_id') as string | null) ?? null,
    createdAt: new Date(row.createdAt as Date).toISOString(),
    updatedAt: new Date(row.updatedAt as Date).toISOString(),
  };
}

function toAggregate(row: Record<string, unknown>, products: Product[]): QuoteAggregate {
  const lines = ((row.lines as Record<string, unknown>[]) ?? []).map((line) => ({
    id: String(line.id),
    quoteId: String(line.quoteId),
    productId: String(line.productId),
    quantity: Number(line.quantity),
    listPrice: Number(line.listPrice),
    discountPercent: Number(line.discountPercent),
    unitCost: Number(line.unitCost),
    recommendedFromId: (line.recommendedFromId as string | null) ?? null,
  })) as QuoteLine[];

  return {
    quote: mapQuote(row),
    customer: mapCustomer(row.customer as Record<string, unknown>),
    lines,
    products: lines
      .map((line) => products.find((item) => item.id === line.productId))
      .filter((item): item is Product => Boolean(item)),
    approvals: ((row.approvals as Record<string, unknown>[]) ?? []).map((item) => ({
      id: String(item.id),
      quoteId: String(item.quoteId),
      chainId: String(item.chainId),
      stepOrder: Number(item.stepOrder),
      roleKey: item.roleKey as ApprovalRoleKey,
      label: String(item.label),
      status: item.status,
      actorId: (item.actorId as string | null) ?? null,
      decidedAt: item.decidedAt ? new Date(item.decidedAt as Date).toISOString() : null,
      decision: (item.decision as string | null) ?? null,
      reason: (item.reason as string | null) ?? null,
      previousValues: item.previousValues,
      newValues: item.newValues,
    })) as QuoteApproval[],
    allocations: ((row.allocations as Record<string, unknown>[]) ?? []).map((item) => ({
      id: String(item.id),
      quoteId: String(item.quoteId),
      quoteLineId: String(item.quoteLineId),
      warehouseId: String(item.warehouseId),
      quantity: Number(item.quantity),
      unitFulfillmentCost: Number(item.unitFulfillmentCost),
      isBackorder: Boolean(item.isBackorder),
      isManualOverride: Boolean(item.isManualOverride),
    })) as FulfillmentSplit[],
    backorders: ((row.backorders as Record<string, unknown>[]) ?? []).map((item) => ({
      id: String(item.id),
      quoteId: String(item.quoteId),
      productId: String(item.productId),
      quantity: Number(item.quantity),
    })),
    schedules: ((row.schedules as Record<string, unknown>[]) ?? []).map((item) => ({
      id: String(item.id),
      quoteId: String(item.quoteId),
      quoteLineId: String(item.quoteLineId),
      billingType: item.billingType as BillingType,
      frequency: (item.frequency as BillingFrequency | null) ?? null,
      amount: Number(item.amount),
      status: item.status as BillingStatus,
      nextBillingAt: item.nextBillingAt ? new Date(item.nextBillingAt as Date).toISOString() : null,
      cancelledAt: item.cancelledAt ? new Date(item.cancelledAt as Date).toISOString() : null,
      prorationAmount: Number(item.prorationAmount),
      refundAmount: Number(item.refundAmount),
      odooInvoiceId: (item.odooInvoiceId as number | null) ?? null,
    })),
    revisions: ((row.revisions as Record<string, unknown>[]) ?? []).map((item) => ({
      id: String(item.id),
      quoteId: String(item.quoteId),
      version: Number(item.version),
      snapshot: item.snapshot,
      materialChange: Boolean(item.materialChange),
      createdBy: (item.createdBy as string | null) ?? null,
      createdAt: new Date(item.createdAt as Date).toISOString(),
    })) as QuoteRevision[],
  };
}

export function createPrismaStore(prisma: unknown): DealflowStore {
  const db = prisma as PrismaLike;

  const loadProducts = async () => (await db.dfProduct.findMany()) as Record<string, unknown>[];

  return {
    async listCustomers() {
      const rows = (await db.dfCustomer.findMany({ orderBy: { name: 'asc' } })) as Record<string, unknown>[];
      return rows.map(mapCustomer);
    },
    async getCustomer(id) {
      const row = (await db.dfCustomer.findUnique({ where: { id } })) as Record<string, unknown> | null;
      return row ? mapCustomer(row) : null;
    },
    async findCustomersByEmail(email) {
      const rows = (await db.dfCustomer.findMany({
        where: { email: { equals: email.trim(), mode: 'insensitive' } },
      })) as Record<string, unknown>[];
      return rows.map(mapCustomer);
    },
    async upsertCustomer(input) {
      const current = input.id ? await this.getCustomer(input.id) : (await this.findCustomersByEmail(input.email))[0];
      if (current) {
        const row = (await db.dfCustomer.update({
          where: { id: current.id },
          data: {
            name: input.name,
            email: input.email.trim(),
            tier: persistCustomerTier(input.tier ?? current.tier),
          },
        })) as Record<string, unknown>;
        return mapCustomer(row);
      }
      const row = (await db.dfCustomer.create({
        data: {
          ...(input.id ? { id: input.id } : {}),
          name: input.name,
          email: input.email.trim(),
          tier: persistCustomerTier(input.tier ?? 'standard'),
        },
      })) as Record<string, unknown>;
      return mapCustomer(row);
    },
    async deleteCustomer(id) {
      await db.dfCustomer.delete?.({ where: { id } });
    },
    async countCustomerQuotes(customerId) {
      return Number(await db.quote.count({ where: { customerId } }));
    },
    async countWonPurchases(customerId) {
      return Number(
        await db.quote.count({
          where: {
            customerId,
            status: { in: ['confirmed', 'fulfillment', 'billing', 'completed'] },
          },
        }),
      );
    },
    async listProducts() {
      return (await loadProducts()).map(mapProduct);
    },
    async getProduct(id) {
      const row = (await db.dfProduct.findUnique({ where: { id } })) as Record<string, unknown> | null;
      return row ? mapProduct(row) : null;
    },
    async upsertProduct(product) {
      const data = {
        sku: product.sku,
        name: product.name,
        category: product.category,
        listPrice: product.listPrice,
        cost: product.cost,
        billingType: product.billingType,
        billingFrequency: product.billingFrequency ?? null,
        description: product.description ?? null,
        taxCategory: product.taxCategory ?? null,
        taxRatePercent: product.taxRatePercent ?? null,
        active: product.active !== false,
        taxable: product.taxable !== false,
        odooProductId: product.odooProductId ?? null,
      };
      const row = (await db.dfProduct.upsert({
        where: { id: product.id },
        update: data,
        create: { id: product.id, ...data },
      })) as Record<string, unknown>;
      return mapProduct(row);
    },
    async deleteProduct(id) {
      await db.dfProduct.delete?.({ where: { id } });
    },
    async countProductQuoteLines(productId) {
      if (!db.quoteLine) return 0;
      return Number(await db.quoteLine.count({ where: { productId } }));
    },
    async listWarehouses() {
      const rows = (await db.dfWarehouse.findMany({ orderBy: { name: 'asc' } })) as Record<string, unknown>[];
      return rows.map((row) => ({
        id: String(row.id),
        name: String(row.name),
        fulfillmentCostPerUnit: Number(row.fulfillmentCostPerUnit),
        odooWarehouseId: (row.odooWarehouseId as number | null) ?? null,
      })) as Warehouse[];
    },
    async upsertWarehouse(warehouse) {
      const data = {
        name: warehouse.name,
        fulfillmentCostPerUnit: warehouse.fulfillmentCostPerUnit,
        odooWarehouseId: warehouse.odooWarehouseId ?? null,
      };
      const row = (await db.dfWarehouse.upsert({
        where: { id: warehouse.id },
        update: data,
        create: { id: warehouse.id, ...data },
      })) as Record<string, unknown>;
      return {
        id: String(row.id),
        name: String(row.name),
        fulfillmentCostPerUnit: Number(row.fulfillmentCostPerUnit),
        odooWarehouseId: (row.odooWarehouseId as number | null) ?? null,
      };
    },
    async deleteWarehouse(id) {
      await db.dfWarehouse.delete?.({ where: { id } });
    },
    async countWarehouseAllocations(warehouseId) {
      if (!db.quoteFulfillmentSplit) return 0;
      return Number(await db.quoteFulfillmentSplit.count({ where: { warehouseId } }));
    },
    async listStock() {
      const rows = (await db.dfStockLevel.findMany()) as Record<string, unknown>[];
      return rows.map((row) => ({
        warehouseId: String(row.warehouseId),
        productId: String(row.productId),
        quantityOnHand: Number(row.quantityOnHand),
        reserved: Number(row.reserved),
        incoming: Number(row.incoming ?? 0),
      })) as StockLevel[];
    },
    async replaceStock(stock) {
      for (const row of stock) {
        await db.dfStockLevel.upsert({
          where: { warehouseId_productId: { warehouseId: row.warehouseId, productId: row.productId } },
          update: { quantityOnHand: row.quantityOnHand, reserved: row.reserved, incoming: row.incoming ?? 0 },
          create: { ...row, incoming: row.incoming ?? 0 },
        });
      }
    },
    async upsertStock(row) {
      await db.dfStockLevel.upsert({
        where: { warehouseId_productId: { warehouseId: row.warehouseId, productId: row.productId } },
        update: { quantityOnHand: row.quantityOnHand, reserved: row.reserved, incoming: row.incoming ?? 0 },
        create: { ...row, incoming: row.incoming ?? 0 },
      });
      return this.listStock();
    },
    async deleteStock(warehouseId, productId) {
      await db.dfStockLevel.delete?.({ where: { warehouseId_productId: { warehouseId, productId } } });
      return this.listStock();
    },
    async listPolicies() {
      const rows = (await db.dfDiscountPolicy.findMany({ orderBy: { priority: 'asc' } })) as Record<string, unknown>[];
      return rows.map(mapPolicy);
    },
    async upsertPolicy(policy) {
      const data = {
        name: policy.name,
        customerTier: policy.customerTier ?? null,
        productCategory: policy.productCategory ?? null,
        warningPercent: policy.warningPercent,
        approvalPercent: policy.approvalPercent,
        rejectPercent: policy.rejectPercent,
        maxMarginImpactPercent: policy.maxMarginImpactPercent,
        priority: policy.priority,
        description: policy.description ?? null,
        active: policy.active !== false,
      };
      const row = (await db.dfDiscountPolicy.upsert({
        where: { id: policy.id },
        update: data,
        create: { id: policy.id, ...data },
      })) as Record<string, unknown>;
      return mapPolicy(row);
    },
    async deletePolicy(id) {
      await db.dfDiscountPolicy.delete?.({ where: { id } });
    },
    async listChains() {
      const rows = (await db.dfApprovalChain.findMany({
        include: { steps: { orderBy: { stepOrder: 'asc' } } },
        orderBy: { priority: 'asc' },
      })) as Record<string, unknown>[];
      return rows.map(mapChain);
    },
    async getChain(id) {
      const row = (await db.dfApprovalChain.findUnique({
        where: { id },
        include: { steps: { orderBy: { stepOrder: 'asc' } } },
      })) as Record<string, unknown> | null;
      return row ? mapChain(row) : null;
    },
    async upsertChain(chain) {
      const data = {
        name: chain.name,
        minRiskScore: chain.minRiskScore,
        minBlendedDiscountPercent: chain.minBlendedDiscountPercent,
        priority: chain.priority,
        active: chain.active !== false,
      };
      const existing = await db.dfApprovalChain.findUnique({ where: { id: chain.id } });
      if (existing) {
        await db.dfApprovalChain.update({
          where: { id: chain.id },
          data: {
            ...data,
            steps: { deleteMany: {} },
          },
        });
      } else {
        await db.dfApprovalChain.create({ data: { id: chain.id, ...data } });
      }
      if (chain.steps.length) {
        await db.dfApprovalChain.update({
          where: { id: chain.id },
          data: {
            steps: {
              create: chain.steps.map((step) => ({
                id: step.id,
                stepOrder: step.stepOrder,
                roleKey: step.roleKey,
                label: step.label,
              })),
            },
          },
        });
      }
      return (await this.getChain(chain.id)) as ApprovalChain;
    },
    async deleteChain(id) {
      await db.dfApprovalChain.delete?.({ where: { id } });
    },
    async countChainApprovals(chainId) {
      const approvals = db.quoteApproval ? Number(await db.quoteApproval.count({ where: { chainId } })) : 0;
      const required = Number(await db.quote.count({ where: { requiredChainId: chainId } }));
      return approvals + required;
    },
    async listQuantityBreaks() {
      try {
        const rows = ((await db.dfQuantityBreak?.findMany()) ??
          (await db.$queryRawUnsafe?.('SELECT * FROM df_quantity_breaks'))) as Record<string, unknown>[] | undefined;
        if (!rows?.length) return structuredClone(DEFAULT_QUANTITY_BREAKS);
        return rows.map((row) => ({
          id: String(row.id),
          name: String(row.name),
          productId: String(field(row, 'productId', 'product_id')),
          customerTier: (field(row, 'customerTier', 'customer_tier') as Customer['tier'] | null) ?? null,
          minQuantity: Number(field(row, 'minQuantity', 'min_quantity')),
          maxQuantity: field(row, 'maxQuantity', 'max_quantity') == null ? null : Number(field(row, 'maxQuantity', 'max_quantity')),
          adjustmentKind: field(row, 'adjustmentKind', 'adjustment_kind') as QuantityBreak['adjustmentKind'],
          adjustmentValue: Number(field(row, 'adjustmentValue', 'adjustment_value')),
          active: field(row, 'active', 'active') !== false,
        }));
      } catch {
        return structuredClone(DEFAULT_QUANTITY_BREAKS);
      }
    },
    async replaceQuantityBreaks(items) {
      if (db.dfQuantityBreak) {
        await db.dfQuantityBreak.deleteMany({});
        for (const item of items) {
          await db.dfQuantityBreak.create({
            data: {
              id: item.id,
              name: item.name,
              productId: item.productId,
              customerTier: item.customerTier ?? null,
              minQuantity: item.minQuantity,
              maxQuantity: item.maxQuantity ?? null,
              adjustmentKind: item.adjustmentKind,
              adjustmentValue: item.adjustmentValue,
              active: item.active !== false,
            },
          });
        }
        return this.listQuantityBreaks();
      }
      await db.$executeRawUnsafe?.('DELETE FROM df_quantity_breaks');
      for (const item of items) {
        await db.$executeRawUnsafe?.(
          `INSERT INTO df_quantity_breaks (id, name, product_id, customer_tier, min_quantity, max_quantity, adjustment_kind, adjustment_value, active, created_at, updated_at)
           VALUES ($1::uuid, $2, $3::uuid, $4::"DfCustomerTier", $5, $6, $7::"DfQuantityAdjustmentKind", $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          item.id,
          item.name,
          item.productId,
          item.customerTier ?? null,
          item.minQuantity,
          item.maxQuantity ?? null,
          item.adjustmentKind,
          item.adjustmentValue,
          item.active !== false,
        );
      }
      return this.listQuantityBreaks();
    },
    async listRoleAuthorities() {
      try {
        const rows = ((await db.dfRoleAuthority?.findMany()) ??
          (await db.$queryRawUnsafe?.('SELECT * FROM df_role_authorities'))) as Record<string, unknown>[] | undefined;
        if (!rows?.length) return structuredClone(DEFAULT_ROLE_AUTHORITIES);
        return rows.map((row) => ({
          roleKey: String(field(row, 'roleKey', 'role_key')),
          maxDiscountPercent: Number(field(row, 'maxDiscountPercent', 'max_discount_percent')),
          minMarginPercent: Number(field(row, 'minMarginPercent', 'min_margin_percent')),
          maxPriceOverridePercent: Number(field(row, 'maxPriceOverridePercent', 'max_price_override_percent')),
          canNegotiate: field(row, 'canNegotiate', 'can_negotiate') !== false,
          exceedAction: field(row, 'exceedAction', 'exceed_action') as RoleAuthority['exceedAction'],
        }));
      } catch {
        return structuredClone(DEFAULT_ROLE_AUTHORITIES);
      }
    },
    async replaceRoleAuthorities(items) {
      if (db.dfRoleAuthority) {
        await db.dfRoleAuthority.deleteMany({});
        for (const item of items) {
          await db.dfRoleAuthority.create({ data: item });
        }
        return this.listRoleAuthorities();
      }
      await db.$executeRawUnsafe?.('DELETE FROM df_role_authorities');
      for (const item of items) {
        await db.$executeRawUnsafe?.(
          `INSERT INTO df_role_authorities (role_key, max_discount_percent, min_margin_percent, max_price_override_percent, can_negotiate, exceed_action, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6::"DfAuthorityExceedAction", CURRENT_TIMESTAMP)`,
          item.roleKey,
          item.maxDiscountPercent,
          item.minMarginPercent,
          item.maxPriceOverridePercent,
          item.canNegotiate,
          item.exceedAction,
        );
      }
      return this.listRoleAuthorities();
    },
    async getGovernance() {
      try {
        const row = ((await db.dfGovernanceConfig?.findUnique({ where: { id: GOVERNANCE_CONFIG_ID } })) ??
          ((await db.$queryRawUnsafe?.('SELECT * FROM df_governance_config WHERE id = $1::uuid LIMIT 1', GOVERNANCE_CONFIG_ID)) as
            | Record<string, unknown>[]
            | undefined)?.[0]) as Record<string, unknown> | null | undefined;
        if (!row) return structuredClone(DEFAULT_GOVERNANCE);
        return {
          cumulativeWarningLimit: Number(field(row, 'cumulativeWarningLimit', 'cumulative_warning_limit')),
          materialDiscountDeltaPp: Number(field(row, 'materialDiscountDeltaPp', 'material_discount_delta_pp')),
          materialTotalDeltaRatio: Number(field(row, 'materialTotalDeltaRatio', 'material_total_delta_ratio')),
          highValueNetTotal: Number(field(row, 'highValueNetTotal', 'high_value_net_total')),
          maxApprovalLevels: Number(field(row, 'maxApprovalLevels', 'max_approval_levels')),
          taxRatePercent: Number(field(row, 'taxRatePercent', 'tax_rate_percent') ?? DEFAULT_GOVERNANCE.taxRatePercent),
          staleQuoteDays: Number(field(row, 'staleQuoteDays', 'stale_quote_days') ?? DEFAULT_GOVERNANCE.staleQuoteDays),
          unusualDiscountPercent: Number(field(row, 'unusualDiscountPercent', 'unusual_discount_percent') ?? DEFAULT_GOVERNANCE.unusualDiscountPercent),
          largeDealNetTotal: Number(field(row, 'largeDealNetTotal', 'large_deal_net_total') ?? DEFAULT_GOVERNANCE.largeDealNetTotal),
          maxCommercialDiscountPercent: Number(
            field(row, 'maxCommercialDiscountPercent', 'max_commercial_discount_percent') ??
              DEFAULT_GOVERNANCE.maxCommercialDiscountPercent,
          ),
          allowLoyaltyStacking: field(row, 'allowLoyaltyStacking', 'allow_loyalty_stacking') !== false,
        } satisfies GovernanceConfig;
      } catch {
        return structuredClone(DEFAULT_GOVERNANCE);
      }
    },
    async replaceGovernance(config) {
      if (db.dfGovernanceConfig) {
        await db.dfGovernanceConfig.upsert({
          where: { id: GOVERNANCE_CONFIG_ID },
          update: config,
          create: { id: GOVERNANCE_CONFIG_ID, ...config },
        });
        return this.getGovernance();
      }
      await db.$executeRawUnsafe?.(
        `INSERT INTO df_governance_config (id, cumulative_warning_limit, material_discount_delta_pp, material_total_delta_ratio, high_value_net_total, max_approval_levels, updated_at)
         VALUES ($1::uuid, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
         ON CONFLICT (id) DO UPDATE SET
           cumulative_warning_limit = EXCLUDED.cumulative_warning_limit,
           material_discount_delta_pp = EXCLUDED.material_discount_delta_pp,
           material_total_delta_ratio = EXCLUDED.material_total_delta_ratio,
           high_value_net_total = EXCLUDED.high_value_net_total,
           max_approval_levels = EXCLUDED.max_approval_levels,
           updated_at = CURRENT_TIMESTAMP`,
        GOVERNANCE_CONFIG_ID,
        config.cumulativeWarningLimit,
        config.materialDiscountDeltaPp,
        config.materialTotalDeltaRatio,
        config.highValueNetTotal,
        config.maxApprovalLevels,
      );
      return this.getGovernance();
    },
    async listRelations() {
      const rows = (await db.dfProductRelation.findMany()) as Record<string, unknown>[];
      return rows.map((row) => ({
        id: String(row.id),
        productId: String(row.productId),
        recommendedProductId: String(row.recommendedProductId),
        kind: row.kind as RelationKind,
        reason: String(row.reason),
        promotion: (row.promotion as string | null) ?? null,
        minQuantity: Number(row.minQuantity),
      })) as ProductRelation[];
    },
    async upsertRelation(relation) {
      const data = {
        productId: relation.productId,
        recommendedProductId: relation.recommendedProductId,
        kind: relation.kind,
        reason: relation.reason,
        promotion: relation.promotion ?? null,
        minQuantity: relation.minQuantity,
      };
      const row = (await db.dfProductRelation.upsert({
        where: { id: relation.id },
        update: data,
        create: { id: relation.id, ...data },
      })) as Record<string, unknown>;
      return {
        id: String(row.id),
        productId: String(row.productId),
        recommendedProductId: String(row.recommendedProductId),
        kind: row.kind as RelationKind,
        reason: String(row.reason),
        promotion: (row.promotion as string | null) ?? null,
        minQuantity: Number(row.minQuantity),
      };
    },
    async deleteRelation(id) {
      await db.dfProductRelation.delete?.({ where: { id } });
    },
    async nextQuoteNumber() {
      const count = Number(await db.quote.count());
      return `DF-${String(count + 1).padStart(5, '0')}`;
    },
    newPortalToken() {
      return randomBytes(24).toString('hex');
    },
    async listQuoteSummaries() {
      const products = (await loadProducts()).map(mapProduct);
      const rows = (await db.quote.findMany({
        include: quoteInclude,
        orderBy: { createdAt: 'desc' },
      })) as Record<string, unknown>[];
      return rows.map((row) => toAggregate(row, products));
    },
    async getQuote(id) {
      const products = (await loadProducts()).map(mapProduct);
      const row = (await db.quote.findUnique({ where: { id }, include: quoteInclude })) as Record<
        string,
        unknown
      > | null;
      return row ? toAggregate(row, products) : null;
    },
    async getQuoteByToken(token) {
      const products = (await loadProducts()).map(mapProduct);
      const row = (await db.quote.findUnique({ where: { portalToken: token }, include: quoteInclude })) as Record<
        string,
        unknown
      > | null;
      return row ? toAggregate(row, products) : null;
    },
    async saveQuote(aggregate) {
      const products = (await loadProducts()).map(mapProduct);
      const existing = await db.quote.findUnique({ where: { id: aggregate.quote.id }, select: { id: true } });
      const data = {
        number: aggregate.quote.number,
        customerId: aggregate.quote.customerId,
        ownerId: uuidOrNull(aggregate.quote.ownerId),
        status: aggregate.quote.status,
        listTotal: aggregate.quote.listTotal,
        discountTotal: aggregate.quote.discountTotal,
        netTotal: aggregate.quote.netTotal,
        costTotal: aggregate.quote.costTotal,
        marginPercent: aggregate.quote.marginPercent,
        blendedDiscountPercent: aggregate.quote.blendedDiscountPercent,
        riskScore: aggregate.quote.riskScore,
        assessmentDecision: aggregate.quote.assessmentDecision,
        requiredChainId: aggregate.quote.requiredChainId,
        portalToken: aggregate.quote.portalToken,
        version: aggregate.quote.version,
        odooSaleOrderId: aggregate.quote.odooSaleOrderId,
        taxTotal: aggregate.quote.taxTotal ?? 0,
        customerDecision: aggregate.quote.customerDecision ?? 'none',
        customerDecisionAt: aggregate.quote.customerDecisionAt ? new Date(aggregate.quote.customerDecisionAt) : null,
        customerDecisionComment: aggregate.quote.customerDecisionComment ?? null,
        customerDecisionVersion: aggregate.quote.customerDecisionVersion ?? null,
        commerciallyFrozenAt: aggregate.quote.commerciallyFrozenAt
          ? new Date(aggregate.quote.commerciallyFrozenAt)
          : null,
        commerciallyFrozenBy: uuidOrNull(aggregate.quote.commerciallyFrozenBy),
        financeLockedAt: aggregate.quote.financeLockedAt ? new Date(aggregate.quote.financeLockedAt) : null,
        financeLockedBy: uuidOrNull(aggregate.quote.financeLockedBy),
        activeNegotiationId: uuidOrNull(aggregate.quote.activeNegotiationId),
      };

      await db.$transaction(async (tx) => {
        if (existing) {
          await tx.quote.update({
            where: { id: aggregate.quote.id },
            data: {
              ...data,
              lines: { deleteMany: {} },
              approvals: { deleteMany: {} },
              allocations: { deleteMany: {} },
              backorders: { deleteMany: {} },
              schedules: { deleteMany: {} },
            },
          });
        } else {
          await tx.quote.create({
            data: { id: aggregate.quote.id, ...data },
          });
        }

        if (aggregate.lines.length) {
          await tx.quote.update({
            where: { id: aggregate.quote.id },
            data: {
              lines: {
                create: aggregate.lines.map((line) => ({
                  id: line.id,
                  productId: line.productId,
                  quantity: line.quantity,
                  listPrice: line.listPrice,
                  discountPercent: line.discountPercent,
                  unitCost: line.unitCost,
                  recommendedFromId: uuidOrNull(line.recommendedFromId),
                })),
              },
            },
          });
        }
        if (aggregate.approvals.length) {
          await tx.quote.update({
            where: { id: aggregate.quote.id },
            data: {
              approvals: {
                create: aggregate.approvals.map((item) => ({
                  id: item.id,
                  chainId: item.chainId,
                  stepOrder: item.stepOrder,
                  roleKey: item.roleKey,
                  label: item.label,
                  status: item.status,
                  actorId: uuidOrNull(item.actorId),
                  decidedAt: item.decidedAt ? new Date(item.decidedAt) : null,
                  decision: item.decision,
                  reason: item.reason,
                  previousValues: item.previousValues ?? undefined,
                  newValues: item.newValues ?? undefined,
                })),
              },
            },
          });
        }
        if (aggregate.allocations.length) {
          await tx.quote.update({
            where: { id: aggregate.quote.id },
            data: {
              allocations: {
                create: aggregate.allocations.map((item) => ({
                  id: item.id,
                  quoteLineId: item.quoteLineId,
                  warehouseId: item.warehouseId,
                  quantity: item.quantity,
                  unitFulfillmentCost: item.unitFulfillmentCost,
                  isBackorder: item.isBackorder,
                  isManualOverride: item.isManualOverride,
                })),
              },
            },
          });
        }
        if (aggregate.backorders.length) {
          await tx.quote.update({
            where: { id: aggregate.quote.id },
            data: {
              backorders: {
                create: aggregate.backorders.map((item) => ({
                  id: item.id,
                  productId: item.productId,
                  quantity: item.quantity,
                })),
              },
            },
          });
        }
        if (aggregate.schedules.length) {
          await tx.quote.update({
            where: { id: aggregate.quote.id },
            data: {
              schedules: {
                create: aggregate.schedules.map((item) => ({
                  id: item.id,
                  quoteLineId: item.quoteLineId,
                  billingType: item.billingType,
                  frequency: item.frequency,
                  amount: item.amount,
                  status: item.status,
                  nextBillingAt: item.nextBillingAt ? new Date(item.nextBillingAt) : null,
                  cancelledAt: item.cancelledAt ? new Date(item.cancelledAt) : null,
                  prorationAmount: item.prorationAmount,
                  refundAmount: item.refundAmount,
                  odooInvoiceId: item.odooInvoiceId,
                })),
              },
            },
          });
        }
        for (const revision of aggregate.revisions) {
          await tx.quoteRevision.upsert({
            where: { id: revision.id },
            update: {},
            create: {
              id: revision.id,
              quoteId: aggregate.quote.id,
              version: revision.version,
              snapshot: revision.snapshot as object,
              materialChange: revision.materialChange,
              createdBy: uuidOrNull(revision.createdBy),
            },
          });
        }
      });

      const saved = (await db.quote.findUnique({
        where: { id: aggregate.quote.id },
        include: quoteInclude,
      })) as Record<string, unknown>;
      return toAggregate(saved, products);
    },
    async deleteQuote(id) {
      await db.quote.delete?.({ where: { id } });
    },
    async listAnomalies() {
      if (!db.dfAnomaly) return [];
      const rows = (await db.dfAnomaly.findMany({ orderBy: { detectedAt: 'desc' } })) as Record<string, unknown>[];
      return rows.map(mapAnomaly);
    },
    async upsertAnomaly(item) {
      if (!db.dfAnomaly) return item;
      const row = (await db.dfAnomaly.upsert({
        where: { id: item.id },
        update: {
          type: item.type,
          severity: item.severity,
          description: item.description,
          status: item.status,
          resolution: item.resolution ?? null,
          resolverId: item.resolverId ?? null,
        },
        create: {
          id: item.id,
          type: item.type,
          severity: item.severity,
          entityType: item.entityType,
          entityId: item.entityId,
          quoteId: item.quoteId ?? null,
          description: item.description,
          status: item.status,
          resolution: item.resolution ?? null,
          resolverId: item.resolverId ?? null,
          detectedAt: new Date(item.detectedAt),
        },
      })) as Record<string, unknown>;
      return mapAnomaly(row);
    },
    async listNegotiations(quoteId) {
      if (!db.dfNegotiationRequest) return [];
      const rows = (await db.dfNegotiationRequest.findMany({
        where: { quoteId },
        orderBy: { createdAt: 'asc' },
      })) as Record<string, unknown>[];
      return rows.map(mapNegotiation);
    },
    async getNegotiation(id) {
      if (!db.dfNegotiationRequest) return null;
      const row = (await db.dfNegotiationRequest.findUnique({ where: { id } })) as Record<string, unknown> | null;
      return row ? mapNegotiation(row) : null;
    },
    async saveNegotiation(item) {
      if (!db.dfNegotiationRequest) return item;
      const data = {
        quoteId: item.quoteId,
        customerId: item.customerId,
        actorId: uuidOrNull(item.actorId),
        actorRole: item.actorRole ?? null,
        requestedDiscountPercent: item.requestedDiscountPercent ?? null,
        requestedTargetAmount: item.requestedTargetAmount ?? null,
        requestedLines: item.requestedLines,
        note: item.note,
        quoteVersion: item.quoteVersion ?? null,
        responseNote: item.responseNote ?? null,
        respondedBy: uuidOrNull(item.respondedBy),
        respondedAt: item.respondedAt ? new Date(item.respondedAt) : null,
        status: item.status,
      };
      const row = (await db.dfNegotiationRequest.upsert({
        where: { id: item.id },
        update: data,
        create: { id: item.id, ...data },
      })) as Record<string, unknown>;
      return mapNegotiation(row);
    },
    async listQuoteEmails(quoteId) {
      if (!db.dfQuoteEmailDelivery) return [];
      const rows = (await db.dfQuoteEmailDelivery.findMany({
        where: { quoteId },
        orderBy: { createdAt: 'asc' },
      })) as Record<string, unknown>[];
      return rows.map(mapQuoteEmail);
    },
    async findQuoteEmailByKey(idempotencyKey) {
      if (!db.dfQuoteEmailDelivery) return null;
      const row = (await db.dfQuoteEmailDelivery.findUnique({
        where: { idempotencyKey },
      })) as Record<string, unknown> | null;
      return row ? mapQuoteEmail(row) : null;
    },
    async saveQuoteEmail(item) {
      if (!db.dfQuoteEmailDelivery) return item;
      const data = {
        quoteId: item.quoteId,
        eventType: item.eventType,
        quoteVersion: item.quoteVersion,
        recipientEmail: item.recipientEmail,
        status: item.status,
        idempotencyKey: item.idempotencyKey,
        notificationDeliveryId: uuidOrNull(item.notificationDeliveryId),
        provider: item.provider ?? null,
        providerMessageId: item.providerMessageId ?? null,
        errorMessage: item.errorMessage ?? null,
        payload: item.payload,
        sentAt: item.sentAt ? new Date(item.sentAt) : null,
      };
      try {
        const row = (await db.dfQuoteEmailDelivery.upsert({
          where: { id: item.id },
          update: data,
          create: { id: item.id, ...data },
        })) as Record<string, unknown>;
        return mapQuoteEmail(row);
      } catch {
        const existing = (await db.dfQuoteEmailDelivery.findUnique({
          where: { idempotencyKey: item.idempotencyKey },
        })) as Record<string, unknown> | null;
        if (existing) return mapQuoteEmail(existing);
        throw new Error('Could not persist customer email delivery');
      }
    },
  };
}

function mapAnomaly(row: Record<string, unknown>): DealflowAnomaly {
  return {
    id: String(row.id),
    type: String(row.type),
    severity: row.severity as AnomalySeverity,
    entityType: String(row.entityType ?? row.entity_type),
    entityId: String(row.entityId ?? row.entity_id),
    quoteId: (row.quoteId ?? row.quote_id) ? String(row.quoteId ?? row.quote_id) : null,
    description: String(row.description),
    status: (row.status as AnomalyStatus) ?? 'open',
    resolution: (row.resolution as string | null) ?? null,
    resolverId: (row.resolverId as string | null) ?? null,
    detectedAt: new Date((row.detectedAt ?? row.detected_at) as Date).toISOString(),
    updatedAt: new Date((row.updatedAt ?? row.updated_at) as Date).toISOString(),
  };
}

function mapPolicy(row: Record<string, unknown>): DiscountPolicy {
  return {
    id: String(row.id),
    name: String(row.name),
    customerTier: (row.customerTier as Customer['tier'] | null) ?? null,
    productCategory: (row.productCategory as string | null) ?? null,
    warningPercent: Number(row.warningPercent),
    approvalPercent: Number(row.approvalPercent),
    rejectPercent: Number(row.rejectPercent),
    maxMarginImpactPercent: Number(row.maxMarginImpactPercent),
    priority: Number(row.priority),
    description: (row.description as string | null) ?? null,
    active: row.active !== false,
  };
}

function mapNegotiation(row: Record<string, unknown>): NegotiationRequest {
  const requestedLines = field(row, 'requestedLines', 'requested_lines');
  return {
    id: String(row.id),
    quoteId: String(field(row, 'quoteId', 'quote_id')),
    customerId: String(field(row, 'customerId', 'customer_id')),
    actorId: (field(row, 'actorId', 'actor_id') as string | null) ?? null,
    actorRole: (field(row, 'actorRole', 'actor_role') as string | null) ?? null,
    requestedDiscountPercent:
      field(row, 'requestedDiscountPercent', 'requested_discount_percent') == null
        ? null
        : Number(field(row, 'requestedDiscountPercent', 'requested_discount_percent')),
    requestedTargetAmount:
      field(row, 'requestedTargetAmount', 'requested_target_amount') == null
        ? null
        : Number(field(row, 'requestedTargetAmount', 'requested_target_amount')),
    requestedLines: (Array.isArray(requestedLines) ? requestedLines : []) as NegotiationRequestedLine[],
    note: String(row.note ?? ''),
    quoteVersion: field(row, 'quoteVersion', 'quote_version') == null ? null : Number(field(row, 'quoteVersion', 'quote_version')),
    responseNote: (field(row, 'responseNote', 'response_note') as string | null) ?? null,
    respondedBy: (field(row, 'respondedBy', 'responded_by') as string | null) ?? null,
    respondedAt: field(row, 'respondedAt', 'responded_at')
      ? new Date(field(row, 'respondedAt', 'responded_at') as Date).toISOString()
      : null,
    status: (row.status as NegotiationStatus) ?? 'open',
    createdAt: new Date((field(row, 'createdAt', 'created_at') as Date)).toISOString(),
    updatedAt: new Date((field(row, 'updatedAt', 'updated_at') as Date)).toISOString(),
  };
}

function mapQuoteEmail(row: Record<string, unknown>): QuoteEmailDelivery {
  const payload = field(row, 'payload', 'payload');
  return {
    id: String(row.id),
    quoteId: String(field(row, 'quoteId', 'quote_id')),
    eventType: (field(row, 'eventType', 'event_type') as QuoteEmailEvent) ?? 'prelim_invoice',
    quoteVersion: Number(field(row, 'quoteVersion', 'quote_version') ?? 1),
    recipientEmail: String(field(row, 'recipientEmail', 'recipient_email') ?? ''),
    status: (row.status as QuoteEmailStatus) ?? 'pending',
    idempotencyKey: String(field(row, 'idempotencyKey', 'idempotency_key')),
    notificationDeliveryId: (field(row, 'notificationDeliveryId', 'notification_delivery_id') as string | null) ?? null,
    provider: (row.provider as string | null) ?? null,
    providerMessageId: (field(row, 'providerMessageId', 'provider_message_id') as string | null) ?? null,
    errorMessage: (field(row, 'errorMessage', 'error_message') as string | null) ?? null,
    payload: (payload && typeof payload === 'object' ? payload : {}) as QuoteEmailDocument,
    sentAt: field(row, 'sentAt', 'sent_at')
      ? new Date(field(row, 'sentAt', 'sent_at') as Date).toISOString()
      : null,
    createdAt: new Date(field(row, 'createdAt', 'created_at') as Date).toISOString(),
    updatedAt: new Date(field(row, 'updatedAt', 'updated_at') as Date).toISOString(),
  };
}

function mapChain(row: Record<string, unknown>): ApprovalChain {
  return {
    id: String(row.id),
    name: String(row.name),
    minRiskScore: Number(row.minRiskScore),
    minBlendedDiscountPercent: Number(row.minBlendedDiscountPercent),
    priority: Number(row.priority),
    active: row.active !== false,
    steps: ((row.steps as Record<string, unknown>[]) ?? []).map((step) => ({
      id: String(step.id),
      chainId: String(step.chainId),
      stepOrder: Number(step.stepOrder),
      roleKey: step.roleKey as ApprovalRoleKey,
      label: String(step.label),
    })),
  };
}
