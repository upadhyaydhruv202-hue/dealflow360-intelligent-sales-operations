import { z } from 'zod';

import { aiFieldNameSchema } from '../ai/ai.schemas';
import { idSchema, requestIdSchema } from '../../schemas/common';
import { DOCUMENT_TYPE_FIELDS, DOCUMENT_TYPES } from './document.types';

export const documentTypeSchema = z.enum(DOCUMENT_TYPES);

function firstFormValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function parseOptionalJsonArray(value: unknown): unknown {
  const scalar = firstFormValue(value);
  if (scalar === undefined || scalar === null || scalar === '') {
    return undefined;
  }

  if (Array.isArray(scalar)) {
    return scalar;
  }

  if (typeof scalar !== 'string') {
    return scalar;
  }

  try {
    return JSON.parse(scalar) as unknown;
  } catch {
    return scalar;
  }
}

function parseOptionalBoolean(value: unknown): unknown {
  const scalar = firstFormValue(value);
  if (scalar === undefined || scalar === null || scalar === '') {
    return undefined;
  }

  if (scalar === true || scalar === 'true' || scalar === '1') {
    return true;
  }

  if (scalar === false || scalar === 'false' || scalar === '0') {
    return false;
  }

  return scalar;
}

export const documentAnalyzeBodySchema = z.object({
  documentType: z.preprocess(firstFormValue, documentTypeSchema),
  fields: z.preprocess(
    parseOptionalJsonArray,
    z.array(aiFieldNameSchema).min(1).max(30).optional(),
  ),
  async: z.preprocess(parseOptionalBoolean, z.boolean().optional()),
});

export const documentIdParamsSchema = z.object({
  id: idSchema,
});

export const documentAnalyzeJobPayloadSchema = z.object({
  documentId: idSchema,
  userId: idSchema,
  fields: z.array(aiFieldNameSchema).min(1).max(30).optional(),
  requestId: requestIdSchema.optional(),
});

export type DocumentAnalyzeBody = z.infer<typeof documentAnalyzeBodySchema>;

export function resolveDocumentFields(
  documentType: z.infer<typeof documentTypeSchema>,
  override?: string[],
): string[] {
  if (override && override.length > 0) {
    return [...new Set(override)];
  }

  return [...DOCUMENT_TYPE_FIELDS[documentType]];
}
