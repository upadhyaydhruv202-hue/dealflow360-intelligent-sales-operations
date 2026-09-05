import { z } from 'zod';

import { requestIdSchema } from '../../schemas/common';

const pdfLineSchema = z.string().trim().min(1).max(500);
const pdfSectionSchema = z.object({
  heading: z.string().trim().min(1).max(120).optional(),
  lines: z.array(pdfLineSchema).min(1).max(80),
});

export const generatePdfInputSchema = z.object({
  title: z.string().trim().min(1).max(120),
  sections: z.array(pdfSectionSchema).max(30).optional(),
  filename: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[A-Za-z0-9._-]+\.pdf$/, 'Filename must be a simple .pdf name')
    .optional(),
  async: z.boolean().optional(),
});

export const pdfGenerateJobPayloadSchema = generatePdfInputSchema.extend({
  storageKey: z.string().min(1).max(512),
  requestId: requestIdSchema.optional(),
});
