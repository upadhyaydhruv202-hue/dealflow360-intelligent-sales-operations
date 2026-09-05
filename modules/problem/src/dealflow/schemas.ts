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

export const lineInputSchema = z
  .object({
    productId: z.string().uuid(),
    quantity: z.number().positive(),
    discountPercent: z.number().min(0).max(100),
  })
  .strict();

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
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required' });

export const decideBodySchema = z
  .object({
    decision: z.enum(['approved', 'rejected']),
    reason: z.string().trim().min(1).max(500),
  })
  .strict();

export const portalChangeBodySchema = z
  .object({
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

export const applyRecommendationBodySchema = z
  .object({
    relationId: z.string().min(1),
  })
  .strict();

export const fulfillmentPlanBodySchema = z
  .object({
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
