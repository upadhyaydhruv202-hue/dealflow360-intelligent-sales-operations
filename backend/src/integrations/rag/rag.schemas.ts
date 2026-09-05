import { z } from 'zod';

import { RAG } from '../../constants';
import { idSchema, requestIdSchema } from '../../schemas/common';

export const ragDocumentIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(RAG.MAX_DOCUMENT_ID_CHARS)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/, 'documentId must be a short identifier');

export const ragChunkIdSchema = z.string().trim().min(1).max(RAG.MAX_CHUNK_ID_CHARS);

export const ragSourceSchema = z.string().trim().min(1).max(RAG.MAX_SOURCE_CHARS);

export const ragMetadataValueSchema = z.union([
  z.string().trim().min(1).max(500),
  z.number().finite(),
  z.boolean(),
  z.null(),
]);

export const ragMetadataSchema = z
  .record(z.string().trim().min(1).max(64), ragMetadataValueSchema)
  .refine((value) => Object.keys(value).length <= RAG.MAX_METADATA_KEYS, {
    message: `metadata may have at most ${RAG.MAX_METADATA_KEYS} keys`,
  })
  .default({});

export const ragTextSchema = z.string().trim().min(1).max(RAG.MAX_DOCUMENT_CHARS);

export const ragQuerySchema = z.string().trim().min(1).max(RAG.MAX_QUERY_CHARS);

export const ragIndexBodySchema = z.object({
  documentId: ragDocumentIdSchema.optional(),
  source: ragSourceSchema,
  text: ragTextSchema,
  metadata: ragMetadataSchema.optional(),
  async: z.boolean().optional(),
});

export const ragDocumentParamsSchema = z.object({
  id: ragDocumentIdSchema,
});

export const ragSearchBodySchema = z.object({
  query: ragQuerySchema,
  topK: z.number().int().min(1).max(RAG.MAX_TOP_K).optional(),
  minScore: z.number().min(-1).max(1).optional(),
  documentIds: z.array(ragDocumentIdSchema).min(1).max(50).optional(),
});

export const ragAskBodySchema = ragSearchBodySchema;

export const ragRetrieveOptionsSchema = z.object({
  query: ragQuerySchema,
  topK: z.number().int().min(1).max(RAG.MAX_TOP_K),
  minScore: z.number().min(-1).max(1),
  documentIds: z.array(ragDocumentIdSchema).min(1).max(50).optional(),
});

export const ragIndexJobPayloadSchema = z.object({
  documentId: ragDocumentIdSchema,
  source: ragSourceSchema,
  text: ragTextSchema,
  metadata: ragMetadataSchema.optional(),
  userId: idSchema.optional(),
  requestId: requestIdSchema.optional(),
});

export const ragAnswerSourceSchema = z.object({
  documentId: ragDocumentIdSchema,
  chunkId: ragChunkIdSchema,
  quote: z.string().trim().min(1).max(RAG.MAX_QUOTE_CHARS).optional(),
});

export const ragAnswerModelSchema = z.object({
  answer: z.string().trim().min(1).max(RAG.MAX_ANSWER_CHARS),
  grounded: z.boolean(),
  confidence: z.number().min(0).max(1),
  sources: z.array(ragAnswerSourceSchema).max(RAG.MAX_TOP_K).default([]),
  unsupported: z.array(z.string().trim().min(1).max(500)).max(12).default([]),
});

export type RagIndexBody = z.infer<typeof ragIndexBodySchema>;
export type RagSearchBody = z.infer<typeof ragSearchBodySchema>;
export type RagAskBody = z.infer<typeof ragAskBodySchema>;
export type RagIndexJobPayload = z.infer<typeof ragIndexJobPayloadSchema>;
export type RagAnswerModel = z.infer<typeof ragAnswerModelSchema>;
