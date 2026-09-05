import type { PrismaClient } from '@prisma/client';

import {
  DEFAULT_CHAINS,
  DEFAULT_CUSTOMERS,
  DEFAULT_POLICIES,
  DEFAULT_PRODUCTS,
  DEFAULT_RELATIONS,
  DEFAULT_STOCK,
  DEFAULT_WAREHOUSES,
} from '../../modules/problem/src/dealflow/defaults';

export async function seedDealflowCatalog(prisma: PrismaClient): Promise<void> {
  for (const customer of DEFAULT_CUSTOMERS) {
    await prisma.dfCustomer.upsert({
      where: { id: customer.id },
      update: { name: customer.name, email: customer.email, tier: customer.tier },
      create: customer,
    });
  }

  for (const product of DEFAULT_PRODUCTS) {
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
      },
      create: {
        ...product,
        billingFrequency: product.billingFrequency ?? null,
      },
    });
  }

  for (const warehouse of DEFAULT_WAREHOUSES) {
    await prisma.dfWarehouse.upsert({
      where: { id: warehouse.id },
      update: { name: warehouse.name, fulfillmentCostPerUnit: warehouse.fulfillmentCostPerUnit },
      create: warehouse,
    });
  }

  for (const row of DEFAULT_STOCK) {
    await prisma.dfStockLevel.upsert({
      where: { warehouseId_productId: { warehouseId: row.warehouseId, productId: row.productId } },
      update: { quantityOnHand: row.quantityOnHand, reserved: row.reserved },
      create: row,
    });
  }

  for (const policy of DEFAULT_POLICIES) {
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
      },
      create: {
        ...policy,
        customerTier: policy.customerTier ?? null,
        productCategory: policy.productCategory ?? null,
      },
    });
  }

  for (const chain of DEFAULT_CHAINS) {
    await prisma.dfApprovalChain.upsert({
      where: { id: chain.id },
      update: {
        name: chain.name,
        minRiskScore: chain.minRiskScore,
        minBlendedDiscountPercent: chain.minBlendedDiscountPercent,
        priority: chain.priority,
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

  for (const relation of DEFAULT_RELATIONS) {
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

  const demoQuoteId = 'ffffffff-ffff-4fff-8fff-fffffffffff1';
  const hardware = DEFAULT_PRODUCTS[0];
  const software = DEFAULT_PRODUCTS[2];
  await prisma.quote.upsert({
    where: { id: demoQuoteId },
    update: {},
    create: {
      id: demoQuoteId,
      number: 'DF-00001',
      customerId: DEFAULT_CUSTOMERS[0].id,
      status: 'draft',
      portalToken: 'df-demo-portal-token-northwind-0001',
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
