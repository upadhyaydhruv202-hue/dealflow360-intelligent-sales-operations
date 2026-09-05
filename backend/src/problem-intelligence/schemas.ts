import { z } from 'zod';

import { PROBLEM_INTELLIGENCE } from '../constants';
import { aiConfidenceSchema } from '../integrations/ai/ai.schemas';
import {
  ACTOR_KINDS,
  ODOO_OPERATIONS,
  REQUIREMENT_CATEGORIES,
  UNKNOWN_VALUE,
} from './types';

export const unknownValueSchema = z.literal(UNKNOWN_VALUE);

export function unknownableStringSchema(max: number) {
  return z.union([unknownValueSchema, z.string().trim().min(1).max(max)]);
}

export function unknownableListSchema<T extends z.ZodTypeAny>(item: T, maxItems: number) {
  return z.preprocess(
    (value) => (value === null || value === undefined ? UNKNOWN_VALUE : value),
    z.union([unknownValueSchema, z.array(item).max(maxItems)]),
  );
}

export const namedItemSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: unknownableStringSchema(1_000),
  confidence: aiConfidenceSchema.optional(),
});

export const actorItemSchema = z.object({
  name: unknownableStringSchema(200),
  kind: z.enum(ACTOR_KINDS),
  description: unknownableStringSchema(1_000),
});

export const workflowItemSchema = z.object({
  name: unknownableStringSchema(200),
  steps: unknownableListSchema(z.string().trim().min(1).max(500), 20),
  actors: unknownableListSchema(z.string().trim().min(1).max(200), 20),
});

export const entityItemSchema = z.object({
  name: unknownableStringSchema(200),
  fields: unknownableListSchema(z.string().trim().min(1).max(100), 30),
  description: unknownableStringSchema(1_000),
});

export const odooRequirementItemSchema = z.object({
  app: unknownableStringSchema(120),
  model: unknownableStringSchema(120),
  operation: z.enum(ODOO_OPERATIONS),
  notes: unknownableStringSchema(1_000),
});

export const requirementCategorySchema = z.enum(REQUIREMENT_CATEGORIES);

export const requirementMappingDraftSchema = z.object({
  requirement: z.string().trim().min(1).max(500),
  category: requirementCategorySchema,
  existingCapability: unknownableStringSchema(128),
  newProblemLogic: unknownableStringSchema(2_000),
  confidence: aiConfidenceSchema,
  evidence: z.string().trim().min(1).max(2_000).optional(),
});

export const problemIntelligenceDraftSchema = z.object({
  problemSummary: unknownableStringSchema(4_000),
  users: unknownableListSchema(namedItemSchema, 20),
  actors: unknownableListSchema(actorItemSchema, 20),
  workflows: unknownableListSchema(workflowItemSchema, 15),
  entities: unknownableListSchema(entityItemSchema, 30),
  businessRules: unknownableListSchema(namedItemSchema, 30),
  integrations: unknownableListSchema(namedItemSchema, 20),
  odooRequirements: unknownableListSchema(odooRequirementItemSchema, 20),
  aiRequirements: unknownableListSchema(namedItemSchema, 20),
  automationRequirements: unknownableListSchema(namedItemSchema, 15),
  notifications: unknownableListSchema(namedItemSchema, 15),
  documents: unknownableListSchema(namedItemSchema, 15),
  reports: unknownableListSchema(namedItemSchema, 15),
  securityRequirements: unknownableListSchema(namedItemSchema, 20),
  nonFunctionalRequirements: unknownableListSchema(namedItemSchema, 20),
  likelyDataRequirements: unknownableListSchema(namedItemSchema, 20),
  likelyInfrastructureRequirements: unknownableListSchema(namedItemSchema, 15),
  mappings: z.array(requirementMappingDraftSchema).max(80),
  confidence: aiConfidenceSchema,
  uncertainty: z.array(z.string().trim().min(1).max(500)).max(30).default([]),
  unknowns: z.array(z.string().trim().min(1).max(200)).max(40).default([]),
  requiresReview: z.boolean(),
});

export const problemIntelligenceAnalyzeBodySchema = z.object({
  statement: z.string().trim().min(1).max(PROBLEM_INTELLIGENCE.MAX_STATEMENT_CHARS),
  title: z.string().trim().min(1).max(PROBLEM_INTELLIGENCE.MAX_TITLE_CHARS).optional(),
});

export type ProblemIntelligenceAnalyzeBody = z.infer<typeof problemIntelligenceAnalyzeBodySchema>;
export type ProblemIntelligenceDraftOutput = z.infer<typeof problemIntelligenceDraftSchema>;
