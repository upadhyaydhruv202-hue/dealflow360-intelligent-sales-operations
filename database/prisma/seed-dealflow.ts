import type { PrismaClient } from '@prisma/client';

import {
  DEFAULT_CHAINS,
  DEFAULT_CUSTOMERS,
  DEFAULT_POLICIES,
  DEFAULT_PRODUCTS,
  DEFAULT_QUANTITY_BREAKS,
  DEFAULT_RELATIONS,
  DEFAULT_ROLE_AUTHORITIES,
  DEFAULT_STOCK,
  DEFAULT_WAREHOUSES,
} from '../../modules/problem/src/dealflow/defaults';
import {
  buildPresentationBook,
  PRESENTATION_PORTAL_TOKEN,
  PRESENTATION_QUOTE_ID,
} from '../../modules/problem/src/dealflow/presentation-book';
import { DEFAULT_GOVERNANCE, GOVERNANCE_CONFIG_ID } from '../../modules/problem/src/dealflow/types';

async function upsertCoreCatalog(
  prisma: PrismaClient,
  options: {
    customers: Array<{ id: string; name: string; email: string; tier: (typeof DEFAULT_CUSTOMERS)[number]['tier'] }>;
    products: Array<{
      id: string;
      sku: string;
      name: string;
      category: string;
      listPrice: number;
      cost: number;
      billingType: (typeof DEFAULT_PRODUCTS)[number]['billingType'];
      billingFrequency?: (typeof DEFAULT_PRODUCTS)[number]['billingFrequency'];
      description?: string | null;
      taxCategory?: string | null;
      taxRatePercent?: number | null;
      active?: boolean;
      taxable?: boolean;
    }>;
    warehouses: Array<{ id: string; name: string; fulfillmentCostPerUnit: number }>;
    stock?: Array<{ warehouseId: string; productId: string; quantityOnHand: number; reserved: number; incoming?: number }>;
    policies: Array<{
      id: string;
      name: string;
      customerTier?: (typeof DEFAULT_POLICIES)[number]['customerTier'];
      productCategory?: string | null;
      warningPercent: number;
      approvalPercent: number;
      rejectPercent: number;
      maxMarginImpactPercent: number;
      priority: number;
      description?: string | null;
      active?: boolean;
    }>;
    chains: Array<{
      id: string;
      name: string;
      minRiskScore: number;
      minBlendedDiscountPercent: number;
      priority: number;
      active?: boolean;
      steps: Array<{ id: string; chainId: string; stepOrder: number; roleKey: string; label: string }>;
    }>;
    relations: Array<{
      id: string;
      productId: string;
      recommendedProductId: string;
      kind: (typeof DEFAULT_RELATIONS)[number]['kind'];
      reason: string;
      promotion?: string | null;
      minQuantity: number;
    }>;
    quantityBreaks: Array<{
      id: string;
      name: string;
      productId: string;
      customerTier?: (typeof DEFAULT_QUANTITY_BREAKS)[number]['customerTier'];
      minQuantity: number;
      maxQuantity?: number | null;
      adjustmentKind: (typeof DEFAULT_QUANTITY_BREAKS)[number]['adjustmentKind'];
      adjustmentValue: number;
      active?: boolean;
    }>;
    roleAuthorities: Array<{
      roleKey: string;
      maxDiscountPercent: number;
      minMarginPercent: number;
      maxPriceOverridePercent: number;
      canNegotiate: boolean;
      exceedAction: (typeof DEFAULT_ROLE_AUTHORITIES)[number]['exceedAction'];
    }>;
  },
): Promise<void> {
  for (const customer of options.customers) {
    await prisma.dfCustomer.upsert({
      where: { id: customer.id },
      update: { name: customer.name, email: customer.email, tier: customer.tier },
      create: customer,
    });
  }

  for (const product of options.products) {
    await prisma.dfProduct.upsert({
      where: { id: product.id },
      update: {
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
      },
      create: {
        id: product.id,
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
      },
    });
  }

  for (const warehouse of options.warehouses) {
    await prisma.dfWarehouse.upsert({
      where: { id: warehouse.id },
      update: { name: warehouse.name, fulfillmentCostPerUnit: warehouse.fulfillmentCostPerUnit },
      create: warehouse,
    });
  }

  if (options.stock) {
    for (const row of options.stock) {
      await prisma.dfStockLevel.upsert({
        where: { warehouseId_productId: { warehouseId: row.warehouseId, productId: row.productId } },
        update: { quantityOnHand: row.quantityOnHand, reserved: row.reserved, incoming: row.incoming ?? 0 },
        create: { ...row, incoming: row.incoming ?? 0 },
      });
    }
  }

  for (const policy of options.policies) {
    await prisma.dfDiscountPolicy.upsert({
      where: { id: policy.id },
      update: {
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
      },
      create: {
        id: policy.id,
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
      },
    });
  }

  for (const chain of options.chains) {
    await prisma.dfApprovalChain.upsert({
      where: { id: chain.id },
      update: {
        name: chain.name,
        minRiskScore: chain.minRiskScore,
        minBlendedDiscountPercent: chain.minBlendedDiscountPercent,
        priority: chain.priority,
        active: chain.active !== false,
        steps: {
          deleteMany: {},
          create: chain.steps.map((step) => ({
            id: step.id,
            stepOrder: step.stepOrder,
            roleKey: step.roleKey,
            label: step.label,
          })),
        },
      },
      create: {
        id: chain.id,
        name: chain.name,
        minRiskScore: chain.minRiskScore,
        minBlendedDiscountPercent: chain.minBlendedDiscountPercent,
        priority: chain.priority,
        active: chain.active !== false,
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

  for (const relation of options.relations) {
    await prisma.dfProductRelation.upsert({
      where: { id: relation.id },
      update: {
        productId: relation.productId,
        recommendedProductId: relation.recommendedProductId,
        kind: relation.kind,
        reason: relation.reason,
        promotion: relation.promotion ?? null,
        minQuantity: relation.minQuantity,
      },
      create: {
        ...relation,
        promotion: relation.promotion ?? null,
      },
    });
  }

  for (const item of options.quantityBreaks) {
    await prisma.dfQuantityBreak.upsert({
      where: { id: item.id },
      update: {
        name: item.name,
        productId: item.productId,
        customerTier: item.customerTier ?? null,
        minQuantity: item.minQuantity,
        maxQuantity: item.maxQuantity ?? null,
        adjustmentKind: item.adjustmentKind,
        adjustmentValue: item.adjustmentValue,
        active: item.active !== false,
      },
      create: {
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

  for (const item of options.roleAuthorities) {
    await prisma.dfRoleAuthority.upsert({
      where: { roleKey: item.roleKey },
      update: item,
      create: item,
    });
  }
  await prisma.dfRoleAuthority.deleteMany({
    where: { roleKey: { notIn: options.roleAuthorities.map((item) => item.roleKey) } },
  });

  await prisma.dfGovernanceConfig.upsert({
    where: { id: GOVERNANCE_CONFIG_ID },
    update: DEFAULT_GOVERNANCE,
    create: { id: GOVERNANCE_CONFIG_ID, ...DEFAULT_GOVERNANCE },
  });
}

async function seedPresentationQuotes(prisma: PrismaClient, ownerId?: string): Promise<void> {
  const book = buildPresentationBook();
  const numbers = book.quotes.map((quote) => quote.number);
  const ids = book.quotes.map((quote) => quote.id);

  await prisma.quote.deleteMany({
    where: {
      OR: [{ id: { in: ids } }, { number: { in: numbers } }],
    },
  });

  for (const quote of book.quotes) {
    await prisma.quote.create({
      data: {
        id: quote.id,
        number: quote.number,
        customerId: quote.customerId,
        ownerId: ownerId ?? null,
        status: quote.status,
        listTotal: quote.listTotal,
        discountTotal: quote.discountTotal,
        netTotal: quote.netTotal,
        costTotal: quote.costTotal,
        marginPercent: quote.marginPercent,
        blendedDiscountPercent: quote.blendedDiscountPercent,
        riskScore: quote.riskScore,
        assessmentDecision: quote.assessmentDecision,
        requiredChainId: quote.requiredChainId ?? null,
        portalToken: quote.portalToken,
        version: quote.version,
        taxTotal: quote.taxTotal,
        customerDecision: quote.customerDecision,
        commerciallyFrozenAt: quote.commerciallyFrozenAt ?? null,
        financeLockedAt: quote.financeLockedAt ?? null,
        createdAt: quote.createdAt,
        lines: {
          create: quote.lines.map((line) => ({
            id: line.id,
            productId: line.productId,
            quantity: line.quantity,
            listPrice: line.listPrice,
            discountPercent: line.discountPercent,
            unitCost: line.unitCost,
          })),
        },
      },
    });

    if (quote.approvals.length) {
      await prisma.quoteApproval.createMany({
        data: quote.approvals.map((item) => ({
          id: item.id,
          quoteId: quote.id,
          chainId: item.chainId,
          stepOrder: item.stepOrder,
          roleKey: item.roleKey,
          label: item.label,
          status: item.status,
          reason: item.reason ?? null,
        })),
      });
    }

    if (quote.allocations.length) {
      await prisma.quoteFulfillmentSplit.createMany({
        data: quote.allocations.map((item) => ({
          id: item.id,
          quoteId: quote.id,
          quoteLineId: item.quoteLineId,
          warehouseId: item.warehouseId,
          quantity: item.quantity,
          unitFulfillmentCost: item.unitFulfillmentCost,
          isBackorder: item.isBackorder,
        })),
      });
    }

    if (quote.backorders.length) {
      await prisma.quoteBackorder.createMany({
        data: quote.backorders.map((item) => ({
          id: item.id,
          quoteId: quote.id,
          productId: item.productId,
          quantity: item.quantity,
        })),
      });
    }

    if (quote.schedules.length) {
      await prisma.quoteBillingSchedule.createMany({
        data: quote.schedules.map((item) => ({
          id: item.id,
          quoteId: quote.id,
          quoteLineId: item.quoteLineId,
          billingType: item.billingType,
          frequency: item.frequency ?? null,
          amount: item.amount,
          status: item.status,
          nextBillingAt: item.nextBillingAt ?? null,
        })),
      });
    }

    if (quote.negotiations.length) {
      for (const item of quote.negotiations) {
        await prisma.dfNegotiationRequest.create({
          data: {
            id: item.id,
            quoteId: quote.id,
            customerId: item.customerId,
            note: item.note,
            requestedDiscountPercent: item.requestedDiscountPercent,
            status: item.status,
            requestedLines: [],
          },
        });
      }
    }
  }
}

export async function seedDealflowCatalog(
  prisma: PrismaClient,
  options: { includePresentationData?: boolean; includePresentationBook?: boolean; ownerId?: string } = {},
): Promise<void> {
  const includeBook = options.includePresentationBook === true;
  const includePresentationData = options.includePresentationData === true || includeBook;

  if (includeBook) {
    const book = buildPresentationBook();
    await upsertCoreCatalog(prisma, {
      customers: book.customers,
      products: book.products,
      warehouses: book.warehouses,
      stock: book.stock,
      policies: book.policies,
      chains: book.chains,
      relations: book.relations,
      quantityBreaks: book.quantityBreaks,
      roleAuthorities: book.roleAuthorities,
    });
    await seedPresentationQuotes(prisma, options.ownerId);
    return;
  }

  if (includePresentationData) {
    for (const customer of DEFAULT_CUSTOMERS) {
      await prisma.dfCustomer.upsert({
        where: { id: customer.id },
        update: { name: customer.name, email: customer.email, tier: customer.tier },
        create: customer,
      });
    }
  }

  await upsertCoreCatalog(prisma, {
    customers: includePresentationData ? DEFAULT_CUSTOMERS : [],
    products: DEFAULT_PRODUCTS,
    warehouses: DEFAULT_WAREHOUSES,
    stock: includePresentationData ? DEFAULT_STOCK : undefined,
    policies: DEFAULT_POLICIES,
    chains: DEFAULT_CHAINS,
    relations: DEFAULT_RELATIONS,
    quantityBreaks: DEFAULT_QUANTITY_BREAKS,
    roleAuthorities: DEFAULT_ROLE_AUTHORITIES,
  });

  if (!includePresentationData) {
    return;
  }

  const hardware = DEFAULT_PRODUCTS[0];
  const software = DEFAULT_PRODUCTS[2];
  await prisma.quote.upsert({
    where: { id: PRESENTATION_QUOTE_ID },
    update: {},
    create: {
      id: PRESENTATION_QUOTE_ID,
      number: 'DF-00001',
      customerId: DEFAULT_CUSTOMERS[0].id,
      status: 'draft',
      portalToken: PRESENTATION_PORTAL_TOKEN,
      lines: {
        create: [
          {
            productId: hardware.id,
            quantity: 8,
            listPrice: hardware.listPrice,
            discountPercent: 0,
            unitCost: hardware.cost,
          },
          {
            productId: software.id,
            quantity: 1,
            listPrice: software.listPrice,
            discountPercent: 0,
            unitCost: software.cost,
          },
        ],
      },
    },
  });
}
