import { z } from 'zod';

export const idParamSchema = z.object({
  id: z.string().uuid(),
});

export const approvalParamSchema = z.object({
  id: z.string().uuid(),
  approvalId: z.string().uuid(),
});

export const lineParamSchema = z.object({
  id: z.string().uuid(),
  lineId: z.string().uuid(),
});

export const billingParamSchema = z.object({
  id: z.string().uuid(),
  scheduleId: z.string().uuid(),
});

export const tokenParamSchema = z.object({
  token: z.string().min(16).max(128),
});

export const expectedVersionSchema = z.object({
  expectedVersion: z.number().int().positive(),
});

export const lineInputSchema = z
  .object({
    productId: z.string().uuid(),
    quantity: z.number().positive(),
    discountPercent: z.number().min(0).max(100),
    expectedVersion: z.number().int().positive().optional(),
  })
  .strict();

export const addLineBodySchema = lineInputSchema.extend({
  expectedVersion: z.number().int().positive(),
});

export const createQuoteBodySchema = z
  .object({
    customerId: z.string().uuid(),
    lines: z.array(lineInputSchema).optional(),
  })
  .strict();

export const patchLineBodySchema = z
  .object({
    productId: z.string().uuid().optional(),
    quantity: z.number().positive().optional(),
    discountPercent: z.number().min(0).max(100).optional(),
    unitPrice: z.number().min(0).optional(),
    expectedVersion: z.number().int().positive(),
  })
  .strict()
  .refine(
    (value) =>
      value.productId !== undefined ||
      value.quantity !== undefined ||
      value.discountPercent !== undefined ||
      value.unitPrice !== undefined,
    {
      message: 'At least one commercial field is required',
    },
  );

export const decideBodySchema = z
  .object({
    decision: z.enum(['approved', 'rejected']),
    reason: z.string().trim().min(1).max(500),
  })
  .strict();

export const portalChangeBodySchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    lines: z
      .array(
        z
          .object({
            lineId: z.string().uuid(),
            quantity: z.number().positive().optional(),
            discountPercent: z.number().min(0).max(100).optional(),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();

export const quantityBreakSchema = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string().trim().min(1).max(120),
    productId: z.string().uuid(),
    customerTier: z.enum(['standard', 'silver', 'gold', 'strategic', 'platinum']).nullable().optional(),
    minQuantity: z.number().positive(),
    maxQuantity: z.number().positive().nullable().optional(),
    adjustmentKind: z.enum(['fixed', 'percent']),
    adjustmentValue: z.number(),
    active: z.boolean().optional(),
  })
  .strict();

export const roleAuthoritySchema = z
  .object({
    roleKey: z.string().trim().min(1).max(40),
    maxDiscountPercent: z.number().min(0).max(100),
    minMarginPercent: z.number().min(0).max(100),
    maxPriceOverridePercent: z.number().min(0).max(100),
    canNegotiate: z.boolean(),
    exceedAction: z.enum(['allow', 'approval', 'block']),
  })
  .strict();

export const replaceQuantityBreaksBodySchema = z
  .object({
    items: z.array(quantityBreakSchema).max(100),
  })
  .strict();

export const replaceRoleAuthoritiesBodySchema = z
  .object({
    items: z.array(roleAuthoritySchema).min(1).max(20),
  })
  .strict();

export const patchGovernanceBodySchema = z
  .object({
    cumulativeWarningLimit: z.number().positive().optional(),
    materialDiscountDeltaPp: z.number().min(0).optional(),
    materialTotalDeltaRatio: z.number().min(0).max(1).optional(),
    highValueNetTotal: z.number().min(0).optional(),
    maxApprovalLevels: z.number().int().min(1).max(3).optional(),
    taxRatePercent: z.number().min(0).max(100).optional(),
    staleQuoteDays: z.number().min(1).optional(),
    unusualDiscountPercent: z.number().min(0).max(100).optional(),
    largeDealNetTotal: z.number().min(0).optional(),
    maxCommercialDiscountPercent: z.number().min(0).max(100).optional(),
    allowLoyaltyStacking: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, { message: 'At least one governance field is required' });

export const vendorContactBodySchema = z
  .object({
    productId: z.string().uuid().optional(),
    message: z.string().trim().min(1).max(1000),
  })
  .strict();

export const applyRecommendationBodySchema = z
  .object({
    relationId: z.string().min(1),
    expectedVersion: z.number().int().positive(),
  })
  .strict();

export const portalDecisionBodySchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    action: z.enum(['accepted', 'declined']),
    comment: z.string().trim().max(500).optional(),
  })
  .strict();

export const anomalyParamSchema = z.object({
  id: z.string().uuid(),
});

export const anomalyDispositionBodySchema = z
  .object({
    status: z.enum(['open', 'acknowledged', 'resolved', 'dismissed']),
    resolution: z.string().trim().max(500).optional(),
  })
  .strict();

export const fulfillmentPlanBodySchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    overrides: z
      .array(
        z
          .object({
            quoteLineId: z.string().uuid(),
            warehouseId: z.string().uuid(),
            quantity: z.number().positive(),
          })
          .strict(),
      )
      .optional(),
  })
  .strict();

export const negotiationParamSchema = z.object({
  id: z.string().uuid(),
  nid: z.string().uuid(),
});

export const requestedLineSchema = z
  .object({
    productId: z.string().uuid().optional(),
    lineId: z.string().uuid().optional(),
    quantity: z.number().positive().optional(),
    discountPercent: z.number().min(0).max(100).optional(),
    action: z.enum(['add', 'remove', 'update']).optional(),
    requestType: z
      .enum(['question', 'quantity_change', 'product_change', 'removal', 'pricing', 'discount', 'general'])
      .optional(),
    comment: z.string().trim().max(1000).optional(),
    originalQuantity: z.number().positive().optional(),
    originalDiscountPercent: z.number().min(0).max(100).optional(),
  })
  .strict();

export const respondNegotiationBodySchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    decision: z.enum(['accepted', 'rejected', 'in_review']),
    responseNote: z.string().trim().min(1).max(2000),
  })
  .strict();

export const negotiationBodySchema = z
  .object({
    expectedVersion: z.number().int().positive().optional(),
    note: z.string().trim().min(1).max(2000),
    requestedDiscountPercent: z.number().min(0).max(100).nullable().optional(),
    requestedTargetAmount: z.number().min(0).nullable().optional(),
    requestedLines: z.array(requestedLineSchema).max(50).optional(),
  })
  .strict();

export const portalNegotiationBodySchema = negotiationBodySchema.extend({
  expectedVersion: z.number().int().positive(),
});

export const managerReviseBodySchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    lines: z
      .array(
        z
          .object({
            lineId: z.string().uuid(),
            quantity: z.number().positive().optional(),
            discountPercent: z.number().min(0).max(100).optional(),
            productId: z.string().uuid().optional(),
          })
          .strict(),
      )
      .optional(),
  })
  .strict();

const productFieldsSchema = z
  .object({
    id: z.string().uuid().optional(),
    sku: z.string().trim().min(1).max(80),
    name: z.string().trim().min(1).max(160),
    category: z.string().trim().min(1).max(80),
    listPrice: z.number().min(0),
    cost: z.number().min(0),
    billingType: z.enum(['one_time', 'recurring']),
    billingFrequency: z.enum(['monthly', 'quarterly', 'yearly']).nullable().optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    taxCategory: z.string().trim().max(80).nullable().optional(),
    taxRatePercent: z.number().min(0).max(100).nullable().optional(),
    active: z.boolean().optional(),
    taxable: z.boolean().optional(),
    stock: z
      .array(
        z
          .object({
            warehouseId: z.string().uuid(),
            quantityOnHand: z.number().min(0),
            incoming: z.number().min(0).optional(),
          })
          .strict(),
      )
      .max(20)
      .optional(),
    quantityBreaks: z
      .array(
        z
          .object({
            id: z.string().uuid().optional(),
            name: z.string().trim().min(1).max(120),
            customerTier: z.enum(['standard', 'silver', 'gold', 'strategic', 'platinum']).nullable().optional(),
            minQuantity: z.number().positive(),
            maxQuantity: z.number().positive().nullable().optional(),
            adjustmentKind: z.enum(['fixed', 'percent']),
            adjustmentValue: z.number(),
            active: z.boolean().optional(),
          })
          .strict(),
      )
      .max(20)
      .optional(),
  })
  .strict();

function refineProductBilling(
  value: { billingType?: 'one_time' | 'recurring'; billingFrequency?: 'monthly' | 'quarterly' | 'yearly' | null },
  ctx: z.RefinementCtx,
) {
  if (value.billingType === 'recurring' && !value.billingFrequency) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Billing frequency is required for subscription products',
      path: ['billingFrequency'],
    });
  }
}

export const productBodySchema = productFieldsSchema.superRefine(refineProductBilling);

export const productPatchBodySchema = productFieldsSchema
  .partial()
  .extend({
    id: z.string().uuid(),
  })
  .superRefine(refineProductBilling);

export const stockBodySchema = z
  .object({
    warehouseId: z.string().uuid(),
    productId: z.string().uuid(),
    quantityOnHand: z.number().min(0),
    reserved: z.number().min(0).optional(),
    incoming: z.number().min(0).optional(),
  })
  .strict();

export const policyBodySchema = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string().trim().min(1).max(160),
    customerTier: z.enum(['standard', 'silver', 'gold', 'strategic', 'platinum']).nullable().optional(),
    productCategory: z.string().trim().max(80).nullable().optional(),
    warningPercent: z.number().min(0).max(100),
    approvalPercent: z.number().min(0).max(100),
    rejectPercent: z.number().min(0).max(100),
    maxMarginImpactPercent: z.number().min(0).max(100),
    priority: z.number().int(),
    description: z.string().trim().max(500).nullable().optional(),
    active: z.boolean().optional(),
  })
  .strict();

export const policyPatchBodySchema = policyBodySchema.extend({
  id: z.string().uuid(),
});

export const chainBodySchema = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string().trim().min(1).max(160),
    minRiskScore: z.number().min(0),
    minBlendedDiscountPercent: z.number().min(0),
    priority: z.number().int(),
    active: z.boolean().optional(),
    steps: z
      .array(
        z
          .object({
            id: z.string().uuid().optional(),
            chainId: z.string().uuid().optional(),
            stepOrder: z.number().int().positive(),
            roleKey: z.enum(['manager', 'finance', 'final']),
            label: z.string().trim().min(1).max(80),
          })
          .strict(),
      )
      .min(1)
      .max(3),
  })
  .strict();

export const chainPatchBodySchema = chainBodySchema.extend({
  id: z.string().uuid(),
});

export const customerBodySchema = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string().trim().min(1).max(160),
    email: z.string().trim().email().max(200),
    tier: z.enum(['standard', 'silver', 'gold', 'strategic', 'platinum']).optional(),
  })
  .strict();

export const customerPatchBodySchema = customerBodySchema.extend({
  id: z.string().uuid(),
});

export const warehouseBodySchema = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string().trim().min(1).max(160),
    fulfillmentCostPerUnit: z.number().min(0),
  })
  .strict();

export const warehousePatchBodySchema = warehouseBodySchema.extend({
  id: z.string().uuid(),
});

export const stockKeySchema = z.object({
  warehouseId: z.string().uuid(),
  productId: z.string().uuid(),
});

export const relationBodySchema = z
  .object({
    id: z.string().uuid().optional(),
    productId: z.string().uuid(),
    recommendedProductId: z.string().uuid(),
    kind: z.enum(['upsell', 'cross_sell']),
    reason: z.string().trim().min(1).max(500),
    promotion: z.string().trim().max(200).nullable().optional(),
    minQuantity: z.number().positive().optional(),
  })
  .strict();

export const relationPatchBodySchema = relationBodySchema.extend({
  id: z.string().uuid(),
});
