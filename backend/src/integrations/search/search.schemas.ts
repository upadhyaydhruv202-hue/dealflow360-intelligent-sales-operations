import { z } from 'zod';

import { FILTER_OPERATORS, SEARCH, SEARCH_MODES } from '../../constants';
import { paginationQuerySchema } from '../../schemas/common';

export const searchIndexNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(SEARCH.MAX_INDEX_NAME_CHARS)
  .regex(/^[a-z][a-z0-9._-]*$/, 'index must be a lowercase identifier');

export const searchDocumentIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(SEARCH.MAX_DOCUMENT_ID_CHARS)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/, 'documentId must be a short identifier');

export const searchQueryTextSchema = z.string().trim().max(SEARCH.MAX_QUERY_CHARS).default('');

export const searchFieldNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(SEARCH.MAX_FIELD_NAME_CHARS)
  .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, 'field names must be identifiers');

export const searchFieldValueSchema = z.union([
  z.string().trim().max(500),
  z.number().finite(),
  z.boolean(),
  z.null(),
]);

export const searchFilterSchema = z.object({
  field: searchFieldNameSchema,
  operator: z.enum(FILTER_OPERATORS),
  value: z.unknown().optional().default(null),
});

export const searchSortSchema = z.object({
  field: z.string().trim().min(1).max(SEARCH.MAX_FIELD_NAME_CHARS),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const searchBodySchema = paginationQuerySchema.and(
  z.object({
    query: searchQueryTextSchema.optional(),
    index: z.union([searchIndexNameSchema, z.array(searchIndexNameSchema).min(1).max(20)]).optional(),
    mode: z.enum(SEARCH_MODES).optional(),
    filters: z.array(searchFilterSchema).max(SEARCH.MAX_FILTERS).optional(),
    sort: z.union([searchSortSchema, z.array(searchSortSchema).min(1).max(3)]).optional(),
    highlight: z.boolean().optional(),
  }),
);

export const searchIndexBodySchema = z.object({
  index: searchIndexNameSchema,
  documentId: searchDocumentIdSchema.optional(),
  title: z.string().trim().max(SEARCH.MAX_TITLE_CHARS).optional(),
  body: z.string().trim().max(SEARCH.MAX_BODY_CHARS).optional(),
  fields: z
    .record(searchFieldNameSchema, searchFieldValueSchema)
    .refine((value) => Object.keys(value).length <= SEARCH.MAX_PAYLOAD_KEYS, {
      message: `fields may have at most ${SEARCH.MAX_PAYLOAD_KEYS} keys`,
    })
    .optional(),
});

export const searchDocumentParamsSchema = z.object({
  index: searchIndexNameSchema,
  documentId: searchDocumentIdSchema,
});

export type SearchBody = z.infer<typeof searchBodySchema>;
export type SearchIndexBody = z.infer<typeof searchIndexBodySchema>;
