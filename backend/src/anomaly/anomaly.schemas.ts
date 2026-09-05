import { ANOMALY, ANOMALY_DETECTORS, ANOMALY_SEVERITIES } from '../constants';
import { idSchema, paginationQuerySchema } from '../schemas/common';
import { z } from 'zod';

const metricSchema = z
  .string()
  .trim()
  .min(1)
  .max(ANOMALY.MAX_METRIC_CHARS)
  .regex(/^[a-zA-Z][a-zA-Z0-9._-]*$/, 'metric must be a short identifier');

const finiteNumber = z.number().finite();

export const anomalyPointObjectSchema = z.object({
  t: z.string().trim().min(1).max(64).optional(),
  value: finiteNumber,
  count: finiteNumber.optional(),
});

export const anomalyPointsSchema = z
  .union([
    z.array(finiteNumber).min(ANOMALY.MIN_POINTS).max(ANOMALY.MAX_POINTS),
    z.array(anomalyPointObjectSchema).min(ANOMALY.MIN_POINTS).max(ANOMALY.MAX_POINTS),
  ])
  .superRefine((points, ctx) => {
    if (points.length > ANOMALY.MAX_POINTS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Provide at most ${ANOMALY.MAX_POINTS} points`,
        path: ['points'],
      });
    }
  });

export const anomalyMetadataSchema = z
  .record(
    z.string().trim().min(1).max(64),
    z.union([z.string().trim().min(1).max(500), finiteNumber, z.boolean(), z.null()]),
  )
  .refine((value) => Object.keys(value).length <= ANOMALY.MAX_METADATA_KEYS, {
    message: `metadata may have at most ${ANOMALY.MAX_METADATA_KEYS} keys`,
  })
  .optional();

const optionalWindow = z.number().int().min(1).max(100).optional();

export const anomalyDetectorConfigSchema = z
  .object({
    threshold: z
      .object({
        enabled: z.boolean().optional(),
        min: finiteNumber.optional(),
        max: finiteNumber.optional(),
      })
      .optional(),
    percentChange: z
      .object({
        enabled: z.boolean().optional(),
        window: optionalWindow,
        lowPct: finiteNumber.min(0).max(1000).optional(),
        mediumPct: finiteNumber.min(0).max(1000).optional(),
        highPct: finiteNumber.min(0).max(1000).optional(),
      })
      .optional(),
    movingAverage: z
      .object({
        enabled: z.boolean().optional(),
        window: optionalWindow,
        deviationPct: finiteNumber.min(0).max(1000).optional(),
      })
      .optional(),
    frequency: z
      .object({
        enabled: z.boolean().optional(),
        minSamples: z.number().int().min(2).max(200).optional(),
        expectedMin: finiteNumber.optional(),
        expectedMax: finiteNumber.optional(),
        zThreshold: finiteNumber.min(0).max(20).optional(),
      })
      .optional(),
    trend: z
      .object({
        enabled: z.boolean().optional(),
        window: z.number().int().min(2).max(100).optional(),
        minSlope: finiteNumber.min(0).max(1_000_000).optional(),
      })
      .optional(),
    zScore: z
      .object({
        enabled: z.boolean().optional(),
        minSamples: z.number().int().min(2).max(200).optional(),
        threshold: finiteNumber.min(0).max(20).optional(),
        highThreshold: finiteNumber.min(0).max(20).optional(),
      })
      .optional(),
  })
  .optional();

export const anomalyEvaluateBodySchema = z.object({
  metric: metricSchema,
  points: anomalyPointsSchema,
  detectors: anomalyDetectorConfigSchema,
  explain: z.boolean().optional(),
  notify: z.boolean().optional(),
  async: z.boolean().optional(),
  metadata: anomalyMetadataSchema,
});

export const anomalyEvaluateJobPayloadSchema = anomalyEvaluateBodySchema.extend({
  userId: idSchema.optional(),
});

export const anomalyFindingParamsSchema = z.object({
  id: idSchema,
});

export const anomalyListQuerySchema = paginationQuerySchema.extend({
  metric: z.preprocess((value) => {
    if (Array.isArray(value)) {
      return value[0];
    }
    return value;
  }, metricSchema.optional()),
  anomaly: z.preprocess((value) => {
    const scalar = Array.isArray(value) ? value[0] : value;
    if (scalar === undefined || scalar === '') {
      return undefined;
    }
    if (scalar === true || scalar === 'true' || scalar === '1') {
      return true;
    }
    if (scalar === false || scalar === 'false' || scalar === '0') {
      return false;
    }
    return scalar;
  }, z.boolean().optional()),
});

export const anomalyExplanationModelSchema = z.object({
  explanation: z.string().trim().min(1).max(ANOMALY.MAX_EXPLANATION_CHARS),
  recommendedAction: z.string().trim().min(1).max(ANOMALY.MAX_ACTION_CHARS),
  confidence: z.number().min(0).max(1).optional(),
});

export const anomalySeveritySchema = z.enum(ANOMALY_SEVERITIES);
export const anomalyDetectorNameSchema = z.enum(ANOMALY_DETECTORS);
