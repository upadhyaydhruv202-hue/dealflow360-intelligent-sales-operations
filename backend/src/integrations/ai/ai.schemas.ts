import { z } from 'zod';

import { AI_GUARDRAILS } from '../../constants';
import { AI_DEFAULTS } from './ai.config';

export const aiPrioritySchema = z.enum(['low', 'medium', 'high']);

export const aiSentimentSchema = z.enum(['positive', 'neutral', 'negative']);

export const aiSummarizeStyleSchema = z.enum(['brief', 'detailed', 'bullet', 'executive']);

export const aiSummarizeLengthSchema = z.enum(['short', 'medium', 'long']);

export const aiExtractSchemaNameSchema = z.enum(['fields', 'entities', 'actionItems']);

export const aiAnalyzeFocusSchema = z.enum(['general', 'risk']);

export const aiDraftToneSchema = z.enum(['neutral', 'friendly', 'formal', 'empathetic']);

export const aiPromptSchema = z.string().trim().min(1).max(AI_DEFAULTS.maxInputChars);

export const aiSystemSchema = z.string().trim().min(1).max(AI_GUARDRAILS.MAX_SYSTEM_CHARS);

export const aiLanguageSchema = z
  .string()
  .trim()
  .min(2)
  .max(32)
  .regex(/^[A-Za-z][A-Za-z0-9_-]*$/, 'Language must be a short language tag');

export const aiLabelSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/, 'Labels must be short identifiers');

export const aiFieldNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, 'Field names must be identifiers');

export const aiTemperatureSchema = z.number().min(0).max(2);

export const aiMaxOutputTokensSchema = z.number().int().positive().max(32_768);

export const aiConfidenceSchema = z.number().min(0).max(1);

export const aiGenerationOptionsSchema = z.object({
  system: aiSystemSchema.optional(),
  temperature: aiTemperatureSchema.optional(),
  maxOutputTokens: aiMaxOutputTokensSchema.optional(),
  model: z.string().trim().min(1).max(128).optional(),
});

export const aiMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: aiPromptSchema,
});

export const aiGenerateTextFieldsSchema = aiGenerationOptionsSchema.extend({
  prompt: aiPromptSchema.optional(),
  messages: z.array(aiMessageSchema).min(1).max(32).optional(),
});

function requirePromptOrMessages(value: { prompt?: string; messages?: unknown[] }): boolean {
  return Boolean(value.prompt) || Boolean(value.messages?.length);
}

export function requireDocumentContent(
  value: { content?: string; text?: string },
  ctx: z.RefinementCtx,
): void {
  if (value.content?.trim() || value.text?.trim()) {
    return;
  }

  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    message: 'Provide content',
    path: ['content'],
  });
}

export function resolveDocumentContent(value: { content?: string; text?: string }): string {
  return (value.content ?? value.text ?? '').trim();
}

export function resolveRecommendContext(value: { context?: string; content?: string }): string {
  return (value.context ?? value.content ?? '').trim();
}

function refineTotalAiInputSize(
  value: {
    prompt?: string;
    system?: string;
    text?: string;
    content?: string;
    context?: string;
    messages?: Array<{ content: string }>;
  },
  ctx: z.RefinementCtx,
): void {
  const messageChars = value.messages?.reduce((sum, message) => sum + message.content.length, 0) ?? 0;
  const total =
    (value.prompt?.length ?? 0) +
    (value.system?.length ?? 0) +
    (value.text?.length ?? 0) +
    (value.content?.length ?? 0) +
    (value.context?.length ?? 0) +
    messageChars;

  if (total <= AI_DEFAULTS.maxInputChars) {
    return;
  }

  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    message: `AI input exceeds the maximum of ${AI_DEFAULTS.maxInputChars} characters`,
    path: value.messages?.length
      ? ['messages']
      : value.content
        ? ['content']
        : value.text
          ? ['text']
          : ['prompt'],
  });
}

export const aiGenerateTextInputSchema = aiGenerateTextFieldsSchema
  .refine(requirePromptOrMessages, {
    message: 'Provide a prompt or messages',
    path: ['prompt'],
  })
  .superRefine(refineTotalAiInputSize);

export const aiInsightSchema = z.object({
  category: z.string().trim().min(1).max(64),
  priority: aiPrioritySchema,
  reason: z.string().trim().min(1).max(2_000),
});

export const aiSummarySchema = z.object({
  summary: z.string().trim().min(1).max(8_000),
  keyPoints: z.array(z.string().trim().min(1).max(1_000)).max(20),
  actions: z.array(z.string().trim().min(1).max(1_000)).max(20),
});

export const aiClassificationSchema = z.object({
  category: z.string().trim().min(1).max(64),
  priority: aiPrioritySchema,
  sentiment: aiSentimentSchema,
  confidence: aiConfidenceSchema,
  reason: z.string().trim().min(1).max(2_000),
});

export const aiRiskItemSchema = z.object({
  risk: z.string().trim().min(1).max(1_000),
  severity: aiPrioritySchema,
  likelihood: aiPrioritySchema.optional(),
  mitigation: z.string().trim().min(1).max(2_000).optional(),
});

export const aiAnalysisSchema = z.object({
  summary: z.string().trim().min(1).max(8_000),
  findings: z.array(z.string().trim().min(1).max(1_000)).max(20),
  risks: z.array(aiRiskItemSchema).max(20),
  sentiment: aiSentimentSchema,
  priority: aiPrioritySchema,
  confidence: aiConfidenceSchema,
  requiresReview: z.boolean(),
});

export const aiRecommendationItemSchema = z.object({
  recommendation: z.string().trim().min(1).max(500),
  reason: z.string().trim().min(1).max(2_000),
  evidence: z.string().trim().min(1).max(2_000).optional(),
  confidence: aiConfidenceSchema,
});

export const aiRecommendationSchema = z.object({
  recommendations: z.array(aiRecommendationItemSchema).min(1).max(10),
});

export const aiActionItemSchema = z.object({
  action: z.string().trim().min(1).max(1_000),
  owner: z.string().trim().min(1).max(200).nullable().optional(),
  due: z.string().trim().min(1).max(64).nullable().optional(),
  priority: aiPrioritySchema.optional(),
});

export const aiEntityFieldsSchema = z.object({
  people: z.array(z.string().trim().min(1).max(200)).max(50),
  organizations: z.array(z.string().trim().min(1).max(200)).max(50),
  locations: z.array(z.string().trim().min(1).max(200)).max(50),
  dates: z.array(z.string().trim().min(1).max(64)).max(50),
  amounts: z.array(z.string().trim().min(1).max(64)).max(50),
  identifiers: z.array(z.string().trim().min(1).max(128)).max(50),
});

export const aiActionItemFieldsSchema = z.object({
  actionItems: z.array(aiActionItemSchema).max(30),
});

export const aiExtractEnvelopeSchema = z.object({
  fields: z.record(z.unknown()),
  missingFields: z.array(z.string().trim().min(1).max(64)).max(50),
  confidence: aiConfidenceSchema,
  warnings: z.array(z.string().trim().min(1).max(500)).max(20),
  requiresReview: z.boolean(),
});

export const aiDraftSchema = z.object({
  draft: z.string().trim().min(1).max(16_000),
  subject: z.string().trim().min(1).max(200).optional(),
  alternatives: z.array(z.string().trim().min(1).max(16_000)).max(3).default([]),
  warnings: z.array(z.string().trim().min(1).max(500)).max(20).default([]),
  confidence: aiConfidenceSchema,
  requiresReview: z.boolean(),
});

const aiDocumentFields = {
  content: aiPromptSchema.optional(),
  text: aiPromptSchema.optional(),
};

export const aiSummarizeFieldsSchema = aiGenerationOptionsSchema.extend({
  ...aiDocumentFields,
  style: aiSummarizeStyleSchema.optional(),
  length: aiSummarizeLengthSchema.optional(),
  language: aiLanguageSchema.optional(),
  maxSentences: z.number().int().min(1).max(20).optional(),
});

export const aiClassifyFieldsSchema = aiGenerationOptionsSchema.extend({
  ...aiDocumentFields,
  labels: z.array(aiLabelSchema).min(2).max(30).optional(),
});

export const aiExtractFieldsSchema = aiGenerationOptionsSchema.extend({
  ...aiDocumentFields,
  schemaName: aiExtractSchemaNameSchema.default('fields'),
  fields: z.array(aiFieldNameSchema).min(1).max(30).optional(),
});

export const aiAnalyzeFieldsSchema = aiGenerationOptionsSchema.extend({
  ...aiDocumentFields,
  focus: aiAnalyzeFocusSchema.optional(),
});

export const aiRecommendFieldsSchema = aiGenerationOptionsSchema.extend({
  context: aiPromptSchema.optional(),
  content: aiPromptSchema.optional(),
  goal: z.string().trim().min(1).max(500).optional(),
  limit: z.number().int().min(1).max(10).optional(),
});

export const aiDraftFieldsSchema = aiGenerationOptionsSchema.extend({
  ...aiDocumentFields,
  purpose: z.string().trim().min(1).max(500).optional(),
  tone: aiDraftToneSchema.optional(),
  audience: z.string().trim().min(1).max(200).optional(),
  language: aiLanguageSchema.optional(),
});

function refineExtractFields(
  value: { schemaName?: 'fields' | 'entities' | 'actionItems'; fields?: string[] },
  ctx: z.RefinementCtx,
): void {
  if ((value.schemaName ?? 'fields') === 'fields' && (!value.fields || value.fields.length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Provide fields when schemaName is "fields"',
      path: ['fields'],
    });
  }
}

function requireRecommendContext(
  value: { context?: string; content?: string },
  ctx: z.RefinementCtx,
): void {
  if (value.context?.trim() || value.content?.trim()) {
    return;
  }

  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    message: 'Provide context',
    path: ['context'],
  });
}

export const aiSummarizeInputSchema = aiSummarizeFieldsSchema
  .superRefine(requireDocumentContent)
  .superRefine(refineTotalAiInputSize);

export const aiClassifyInputSchema = aiClassifyFieldsSchema
  .superRefine(requireDocumentContent)
  .superRefine(refineTotalAiInputSize);

export const aiExtractInputSchema = aiExtractFieldsSchema
  .superRefine(requireDocumentContent)
  .superRefine(refineExtractFields)
  .superRefine(refineTotalAiInputSize);

export const aiAnalyzeInputSchema = aiAnalyzeFieldsSchema
  .superRefine(requireDocumentContent)
  .superRefine(refineTotalAiInputSize);

export const aiRecommendInputSchema = aiRecommendFieldsSchema
  .superRefine(requireRecommendContext)
  .superRefine(refineTotalAiInputSize);

export const aiDraftInputSchema = aiDraftFieldsSchema
  .superRefine(requireDocumentContent)
  .superRefine(refineTotalAiInputSize);

export const aiEmbedInputSchema = z.object({
  text: aiPromptSchema,
  model: z.string().trim().min(1).max(128).optional(),
});

export const aiDecisionEnvelopeSchema = z.object({
  result: z.record(z.unknown()),
  confidence: aiConfidenceSchema,
  evidence: z.array(z.string().trim().min(1).max(2_000)).max(20).default([]),
  requiresReview: z.boolean(),
});

export const aiStructuredSchemaNameSchema = z.enum(['insight', 'decision']);

export const aiHttpMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: aiPromptSchema,
});

const httpUnsafeKeys = { model: true, system: true } as const;

export const aiGenerateTextBodySchema = aiGenerateTextFieldsSchema
  .omit(httpUnsafeKeys)
  .extend({
    messages: z.array(aiHttpMessageSchema).min(1).max(32).optional(),
  })
  .refine(requirePromptOrMessages, {
    message: 'Provide a prompt or messages',
    path: ['prompt'],
  })
  .superRefine(refineTotalAiInputSize);

export const aiSummarizeBodySchema = aiSummarizeFieldsSchema
  .omit(httpUnsafeKeys)
  .superRefine(requireDocumentContent)
  .superRefine(refineTotalAiInputSize);

export const aiClassifyBodySchema = aiClassifyFieldsSchema
  .omit(httpUnsafeKeys)
  .superRefine(requireDocumentContent)
  .superRefine(refineTotalAiInputSize);

export const aiExtractBodySchema = aiExtractFieldsSchema
  .omit(httpUnsafeKeys)
  .superRefine(requireDocumentContent)
  .superRefine(refineExtractFields)
  .superRefine(refineTotalAiInputSize);

export const aiAnalyzeBodySchema = aiAnalyzeFieldsSchema
  .omit(httpUnsafeKeys)
  .superRefine(requireDocumentContent)
  .superRefine(refineTotalAiInputSize);

export const aiRecommendBodySchema = aiRecommendFieldsSchema
  .omit(httpUnsafeKeys)
  .superRefine(requireRecommendContext)
  .superRefine(refineTotalAiInputSize);

export const aiDraftBodySchema = aiDraftFieldsSchema
  .omit(httpUnsafeKeys)
  .superRefine(requireDocumentContent)
  .superRefine(refineTotalAiInputSize);

export const aiStructuredBodySchema = aiGenerationOptionsSchema.omit(httpUnsafeKeys).extend({
  prompt: aiPromptSchema,
  schemaName: aiStructuredSchemaNameSchema.default('insight'),
});

export const aiEmbedBodySchema = aiEmbedInputSchema.omit({ model: true });

export const AI_OUTPUT_SCHEMAS = {
  insight: aiInsightSchema,
  decision: aiDecisionEnvelopeSchema,
} as const;

export const AI_EXTRACT_SCHEMA_NAMES = aiExtractSchemaNameSchema.options;

export type AiDecisionEnvelope = z.infer<typeof aiDecisionEnvelopeSchema>;
export type AiInsightOutput = z.infer<typeof aiInsightSchema>;
export type AiSummaryOutput = z.infer<typeof aiSummarySchema>;
export type AiClassificationOutput = z.infer<typeof aiClassificationSchema>;
export type AiAnalysisOutput = z.infer<typeof aiAnalysisSchema>;
export type AiRecommendationOutput = z.infer<typeof aiRecommendationSchema>;
export type AiExtractionOutput = z.infer<typeof aiExtractEnvelopeSchema>;
export type AiDraftOutput = z.infer<typeof aiDraftSchema>;
export type AiGenerateTextBody = z.infer<typeof aiGenerateTextBodySchema>;
export type AiSummarizeBody = z.infer<typeof aiSummarizeBodySchema>;
export type AiClassifyBody = z.infer<typeof aiClassifyBodySchema>;
export type AiExtractBody = z.infer<typeof aiExtractBodySchema>;
export type AiAnalyzeBody = z.infer<typeof aiAnalyzeBodySchema>;
export type AiRecommendBody = z.infer<typeof aiRecommendBodySchema>;
export type AiDraftBody = z.infer<typeof aiDraftBodySchema>;
export type AiStructuredBody = z.infer<typeof aiStructuredBodySchema>;
export type AiEmbedBody = z.infer<typeof aiEmbedBodySchema>;

export function buildClassificationSchema(labels?: string[]) {
  if (!labels?.length) {
    return aiClassificationSchema;
  }

  const [first, ...rest] = labels;
  return aiClassificationSchema.extend({
    category: z.enum([first, ...rest] as [string, ...string[]]),
  });
}

export function buildExtractFieldsObjectSchema(fields: string[]) {
  return z.object(
    Object.fromEntries(fields.map((field) => [field, z.unknown().nullable()])) as Record<string, z.ZodTypeAny>,
  );
}

export function buildExtractSchema(
  schemaName: 'fields' | 'entities' | 'actionItems' = 'fields',
  fields: string[] = [],
) {
  const fieldsSchema =
    schemaName === 'entities'
      ? aiEntityFieldsSchema
      : schemaName === 'actionItems'
        ? aiActionItemFieldsSchema
        : buildExtractFieldsObjectSchema(fields);

  return aiExtractEnvelopeSchema.extend({
    fields: fieldsSchema,
  });
}
