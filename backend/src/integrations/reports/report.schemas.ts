import { z } from 'zod';

import { REPORTS } from '../../constants';
import { emailSchema, requestIdSchema } from '../../schemas/common';

export const reportTypeIdSchema = z
  .string()
  .trim()
  .regex(/^[a-z][a-z0-9_-]{0,63}$/, 'Report type must be a lowercase id such as table or summary');

const factValueSchema = z.union([z.string().max(2_000), z.number(), z.boolean(), z.null()]);

export const reportNarrativeSchema = z.union([
  z
    .string()
    .trim()
    .min(1)
    .max(REPORTS.MAX_NARRATIVE_CHARS),
  z.object({
    text: z.string().trim().min(1).max(REPORTS.MAX_NARRATIVE_CHARS),
    source: z.literal('ai').optional(),
    generatedAt: z.string().trim().min(1).max(64).optional(),
  }),
]);

export const reportTableSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  columns: z.array(z.string().trim().min(1).max(80)).min(1).max(REPORTS.MAX_TABLE_COLUMNS),
  rows: z
    .array(z.array(z.union([z.string().max(500), z.number(), z.boolean(), z.null()])).max(REPORTS.MAX_TABLE_COLUMNS))
    .max(REPORTS.MAX_TABLE_ROWS),
});

export const reportChartSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  labels: z.array(z.string().trim().min(1).max(40)).min(1).max(REPORTS.MAX_CHART_POINTS),
  values: z.array(z.number().finite()).min(1).max(REPORTS.MAX_CHART_POINTS),
});

export const reportSectionSchema = z.object({
  heading: z.string().trim().min(1).max(120).optional(),
  lines: z.array(z.string().trim().min(1).max(500)).min(1).max(REPORTS.MAX_SECTION_LINES),
});

export const reportRenderOptionsSchema = z.object({
  filename: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[A-Za-z0-9._-]+\.pdf$/, 'Filename must be a simple .pdf name')
    .optional(),
  header: z.string().trim().min(1).max(120).optional(),
  footer: z.string().trim().min(1).max(120).optional(),
  pageNumbers: z.boolean().optional(),
  timestamp: z.boolean().optional(),
  metadata: z
    .object({
      author: z.string().trim().min(1).max(120).optional(),
      subject: z.string().trim().min(1).max(200).optional(),
      keywords: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
    })
    .optional(),
  async: z.boolean().optional(),
  notify: z.boolean().optional(),
  email: emailSchema.optional(),
});

export const generateReportInputSchema = z.object({
  type: reportTypeIdSchema,
  data: z.record(z.string().min(1).max(64), z.unknown()).refine((value) => Object.keys(value).length <= 80, {
    message: 'Report data has too many keys',
  }),
  options: reportRenderOptionsSchema.optional(),
});

export const generateReportBodySchema = generateReportInputSchema;

export const reportGenerateJobPayloadSchema = generateReportInputSchema.extend({
  storageKey: z
    .string()
    .trim()
    .min(1)
    .max(512)
    .regex(/^reports\/[A-Za-z0-9._/-]+\.pdf$/, 'Report storage key must be a reports/*.pdf path')
    .refine((key) => !key.includes('..'), { message: 'Report storage key must not contain traversal' }),
  userId: z.string().uuid().optional(),
  requestId: requestIdSchema.optional(),
});

export const reportFactRecordSchema = z
  .record(z.string().min(1).max(64), factValueSchema)
  .refine((value) => Object.keys(value).length <= REPORTS.MAX_FACT_KEYS, {
    message: `Facts cannot exceed ${REPORTS.MAX_FACT_KEYS} keys`,
  });
