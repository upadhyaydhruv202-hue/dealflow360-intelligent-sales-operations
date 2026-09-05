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
    customerTier: z.enum(['standard', 'silver', 'gold', 'strategic']).nullable().optional(),
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
