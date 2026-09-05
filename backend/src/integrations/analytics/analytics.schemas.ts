import { z } from 'zod';

import {
  ANALYTICS,
  ANALYTICS_AGGREGATIONS,
  ANALYTICS_EXPORT_FORMATS,
  ANALYTICS_GRANULARITIES,
  ANALYTICS_QUERY_KINDS,
} from '../../constants';
import { paginationQuerySchema } from '../../schemas/common';

export const analyticsKpiNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(ANALYTICS.MAX_KPI_NAME_CHARS)
  .regex(/^[a-z][a-z0-9._-]*$/, 'kpi must be a lowercase identifier');

export const analyticsSourceSchema = z
  .string()
  .trim()
  .min(1)
  .max(ANALYTICS.MAX_SOURCE_CHARS)
  .regex(/^[a-z][a-z0-9._-]*$/, 'source must be a lowercase identifier');

export const analyticsEventIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(ANALYTICS.MAX_EVENT_ID_CHARS)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/, 'eventId must be a short identifier');

export const analyticsFieldNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(ANALYTICS.MAX_FIELD_NAME_CHARS)
  .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, 'field names must be identifiers');

export const analyticsDimensionValueSchema = z.union([
  z.string().trim().max(ANALYTICS.MAX_DIMENSION_CHARS),
  z.number().finite().min(ANALYTICS.MIN_VALUE).max(ANALYTICS.MAX_VALUE),
  z.boolean(),
  z.null(),
]);

export const analyticsFilterSchema = z.object({
  field: analyticsFieldNameSchema,
  operator: z.enum(['eq', 'neq', 'in', 'gte', 'lte']),
  value: z.unknown().optional().default(null),
});

const isoTimestamp = z.string().datetime({ offset: true });

export const analyticsFactSchema = z.object({
  kpi: analyticsKpiNameSchema,
  occurredAt: isoTimestamp,
  value: z.number().finite().min(ANALYTICS.MIN_VALUE).max(ANALYTICS.MAX_VALUE).optional(),
  dimensions: z
    .record(analyticsFieldNameSchema, analyticsDimensionValueSchema)
    .refine((value) => Object.keys(value).length <= ANALYTICS.MAX_DIMENSIONS, {
      message: `dimensions may have at most ${ANALYTICS.MAX_DIMENSIONS} keys`,
    })
    .optional(),
  eventId: analyticsEventIdSchema.optional(),
  ownerId: z.string().uuid().nullable().optional(),
  source: analyticsSourceSchema.optional(),
});

export const analyticsIngestBodySchema = z.union([
  analyticsFactSchema.transform((fact) => ({ facts: [fact] })),
  z.object({
    facts: z.array(analyticsFactSchema).min(1).max(ANALYTICS.MAX_INGEST_BATCH),
  }),
]);

export const analyticsQueryBodySchema = paginationQuerySchema.and(
  z.object({
    kpi: analyticsKpiNameSchema,
    kind: z.enum(ANALYTICS_QUERY_KINDS).optional(),
    from: isoTimestamp.optional(),
    to: isoTimestamp.optional(),
    granularity: z.enum(ANALYTICS_GRANULARITIES).optional(),
    groupBy: analyticsFieldNameSchema.optional(),
    filters: z.array(analyticsFilterSchema).max(ANALYTICS.MAX_FILTERS).optional(),
  }),
);

export const analyticsExportBodySchema = analyticsQueryBodySchema.and(
  z.object({
    format: z.enum(ANALYTICS_EXPORT_FORMATS).optional(),
  }),
);

export const analyticsDashboardParamsSchema = z.object({
  name: analyticsKpiNameSchema,
});

export const analyticsDashboardQuerySchema = z.object({
  from: isoTimestamp.optional(),
  to: isoTimestamp.optional(),
  granularity: z.enum(ANALYTICS_GRANULARITIES).optional(),
  filters: z.array(analyticsFilterSchema).max(ANALYTICS.MAX_FILTERS).optional(),
});

export const analyticsAggregationSchema = z.enum(ANALYTICS_AGGREGATIONS);

export type AnalyticsFactBody = z.infer<typeof analyticsFactSchema>;
export type AnalyticsIngestBody = z.infer<typeof analyticsIngestBodySchema>;
export type AnalyticsQueryBody = z.infer<typeof analyticsQueryBodySchema>;
export type AnalyticsExportBody = z.infer<typeof analyticsExportBodySchema>;
