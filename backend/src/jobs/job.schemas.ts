import { z } from 'zod';

import { JOBS } from '../constants';
import { requestIdSchema } from '../schemas/common';

export const jobIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9._:-]+$/, 'Job IDs may contain letters, numbers, dots, underscores, colons, and dashes');

export const jobIdParamsSchema = z.object({
  jobId: jobIdSchema,
});

export const cleanupJobPayloadSchema = z.object({
  maxAgeMs: z.number().int().min(1).max(7 * 24 * 60 * 60 * 1000).optional(),
  requestId: requestIdSchema.optional(),
});

export const odooSyncJobPayloadSchema = z.object({
  capability: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[a-z][a-z0-9._-]*$/),
  method: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[a-z][a-z0-9_]*$/),
  ids: z.array(z.number().int().positive()).max(500).optional(),
  params: z.record(z.string().min(1).max(64), z.unknown()).optional(),
  context: z.record(z.string().min(1).max(64), z.unknown()).optional(),
  requestId: requestIdSchema.optional(),
});

export type CleanupJobPayload = z.infer<typeof cleanupJobPayloadSchema>;
export type OdooSyncJobPayload = z.infer<typeof odooSyncJobPayloadSchema>;

export const DEFAULT_CLEANUP_MAX_AGE_MS = JOBS.STATUS_TTL_MS;
