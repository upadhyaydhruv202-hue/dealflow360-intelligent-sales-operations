import { randomBytes } from 'node:crypto';

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
  Product,
  ProductRelation,
  Quote,
  QuoteAggregate,
  QuoteApproval,
  QuoteLine,
  QuoteRevision,
  QuoteStatus,
  RelationKind,
  StockLevel,
  Warehouse,
} from './types';

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
  quote: PrismaDelegate;
  quoteRevision: PrismaDelegate;
  $transaction: (fn: (tx: PrismaLike) => Promise<unknown>) => Promise<unknown>;
};

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
    odooProductId: (row.odooProductId as number | null) ?? null,
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
    async listProducts() {
      return (await loadProducts()).map(mapProduct);
    },
    async getProduct(id) {
      const row = (await db.dfProduct.findUnique({ where: { id } })) as Record<string, unknown> | null;
      return row ? mapProduct(row) : null;
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
    async listStock() {
      const rows = (await db.dfStockLevel.findMany()) as Record<string, unknown>[];
      return rows.map((row) => ({
        warehouseId: String(row.warehouseId),
        productId: String(row.productId),
        quantityOnHand: Number(row.quantityOnHand),
        reserved: Number(row.reserved),
      })) as StockLevel[];
    },
    async replaceStock(stock) {
      for (const row of stock) {
        await db.dfStockLevel.upsert({
          where: { warehouseId_productId: { warehouseId: row.warehouseId, productId: row.productId } },
          update: { quantityOnHand: row.quantityOnHand, reserved: row.reserved },
          create: row,
        });
      }
    },
    async listPolicies() {
      const rows = (await db.dfDiscountPolicy.findMany({ orderBy: { priority: 'asc' } })) as Record<string, unknown>[];
      return rows.map((row) => ({
        id: String(row.id),
        name: String(row.name),
        customerTier: (row.customerTier as Customer['tier'] | null) ?? null,
        productCategory: (row.productCategory as string | null) ?? null,
        warningPercent: Number(row.warningPercent),
        approvalPercent: Number(row.approvalPercent),
        rejectPercent: Number(row.rejectPercent),
        maxMarginImpactPercent: Number(row.maxMarginImpactPercent),
        priority: Number(row.priority),
      })) as DiscountPolicy[];
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
  };
}

function mapChain(row: Record<string, unknown>): ApprovalChain {
  return {
    id: String(row.id),
    name: String(row.name),
    minRiskScore: Number(row.minRiskScore),
    minBlendedDiscountPercent: Number(row.minBlendedDiscountPercent),
    priority: Number(row.priority),
    steps: ((row.steps as Record<string, unknown>[]) ?? []).map((step) => ({
      id: String(step.id),
      chainId: String(step.chainId),
      stepOrder: Number(step.stepOrder),
      roleKey: step.roleKey as ApprovalRoleKey,
      label: String(step.label),
    })),
  };
}
