import { z } from 'zod';

import { STORAGE, STORAGE_PURPOSES } from '../../constants';
import { idSchema } from '../../schemas/common';

export const storagePurposeSchema = z.enum(STORAGE_PURPOSES);

export const storageDownloadQuerySchema = z.object({
  key: z.string().trim().min(1).max(512),
  expires: z.string().trim().min(1).max(20),
  sig: z.string().trim().min(32).max(128).regex(/^[a-f0-9]+$/i),
  uid: z
    .string()
    .trim()
    .min(1)
    .max(128)
    .regex(/^[A-Za-z0-9._-]+$/)
    .optional(),
});

export const storageFileIdParamsSchema = z.object({
  id: idSchema,
});

export const storageUploadBodySchema = z.object({
  purpose: z.preprocess((value) => {
    if (typeof value !== 'string') {
      return value;
    }

    const trimmed = value.trim().toLowerCase();
    return trimmed === '' ? undefined : trimmed;
  }, storagePurposeSchema.optional()),
});

export const storageSignedUrlBodySchema = z.object({
  expiresInSeconds: z.coerce
    .number()
    .int()
    .positive()
    .max(STORAGE.SIGNED_URL_MAX_SECONDS)
    .optional(),
});
