import { z } from 'zod';

import { FILTER_OPERATORS, PAGINATION, REQUEST_ID, UPLOAD } from '../constants';

function blankToUndefined(value: unknown): unknown {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === 'string' && value.trim() === '') {
    return undefined;
  }

  return value;
}

function firstQueryValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

const optionalQueryScalar = z.preprocess((value) => blankToUndefined(firstQueryValue(value)), z.unknown().optional());

export const idSchema = z.string().uuid();

export const emailSchema = z.string().trim().toLowerCase().email().max(254);

export const e164PhoneSchema = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{7,14}$/, 'Phone must be E.164 (for example +15551234567)');

export const urlSchema = z.string().trim().url().max(2048);

export const isoDateStringSchema = z.string().datetime({ offset: true });

export const dateSchema = z.preprocess((value) => {
  const normalized = blankToUndefined(firstQueryValue(value));
  return normalized;
}, z.coerce.date());

export const requestIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(REQUEST_ID.MAX_LENGTH)
  .regex(REQUEST_ID.PATTERN);

export function enumSchema<T extends [string, ...string[]]>(values: T) {
  return z.enum(values);
}

export const paginationQuerySchema = z.object({
  page: optionalQueryScalar.pipe(z.coerce.number().int().min(1).default(PAGINATION.DEFAULT_PAGE)),
  pageSize: optionalQueryScalar.pipe(
    z.coerce.number().int().min(1).max(PAGINATION.MAX_PAGE_SIZE).default(PAGINATION.DEFAULT_PAGE_SIZE),
  ),
});

export const sortOrderSchema = z.enum(['asc', 'desc']);

export const sortQuerySchema = z.object({
  sortBy: z.preprocess((value) => {
    const scalar = blankToUndefined(firstQueryValue(value));
    return typeof scalar === 'string' ? scalar.trim() : scalar;
  }, z.string().min(1).max(64).optional()),
  sortOrder: z.preprocess((value) => {
    const scalar = blankToUndefined(firstQueryValue(value));
    return typeof scalar === 'string' ? scalar.trim().toLowerCase() : scalar;
  }, sortOrderSchema.optional()),
});

export const filterOperatorSchema = z.enum(FILTER_OPERATORS);

export const filterRuleSchema = z.object({
  field: z.string().min(1).max(64),
  operator: filterOperatorSchema,
  value: z.unknown(),
});

export const filterRulesSchema = z.array(filterRuleSchema).max(20);

const mimeTypeSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i, 'MIME type must look like type/subtype');

export interface FileMetadataOptions {
  maxBytes?: number;
  allowedMimeTypes?: readonly string[];
}

export function createFileMetadataSchema(options: FileMetadataOptions = {}) {
  const maxBytes = options.maxBytes ?? UPLOAD.MAX_BYTES;
  const allowed = options.allowedMimeTypes;

  return z
    .object({
      fieldname: z.string().min(1).max(64).optional(),
      originalname: z.string().min(1).max(UPLOAD.MAX_FILENAME_LENGTH),
      encoding: z.string().min(1).max(32).optional(),
      mimetype:
        allowed && allowed.length > 0
          ? mimeTypeSchema.refine((value) => allowed.includes(value), { message: 'File type is not allowed' })
          : mimeTypeSchema,
      size: z.number().int().nonnegative().max(maxBytes),
    })
    .strip();
}

export const uploadedFileMetadataSchema = createFileMetadataSchema();

export const idParamsSchema = z.object({
  id: idSchema,
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
export type SortQuery = z.infer<typeof sortQuerySchema>;
export type FilterRuleInput = z.infer<typeof filterRuleSchema>;
export type UploadedFileMetadata = z.infer<typeof uploadedFileMetadataSchema>;
