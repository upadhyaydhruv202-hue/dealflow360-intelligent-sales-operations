import { z } from 'zod';

import { aiConfidenceSchema } from '../integrations/ai/ai.schemas';
import { REQUIREMENT_CATEGORIES, REQUIREMENT_CLASSIFICATIONS, UNKNOWN_VALUE } from '../problem-intelligence';

const unknownableString = z.union([z.literal(UNKNOWN_VALUE), z.string().trim().min(1).max(4_000)]);

const unknownableListSchema = z.object({
  determined: z.boolean(),
  items: z.array(z.unknown()).max(40),
});

const existingCapabilityObjectSchema = z.object({
  name: z.string().trim().min(1).max(128),
  summary: z.string().trim().min(1).max(500).optional(),
  maturity: z.string().trim().min(1).max(32).optional(),
});

export const recommendationMappingSchema = z.object({
  requirement: z.string().trim().min(1).max(500),
  category: z.enum(REQUIREMENT_CATEGORIES),
  classification: z.enum(REQUIREMENT_CLASSIFICATIONS).optional(),
  existingCapability: z
    .union([existingCapabilityObjectSchema, unknownableString, z.null()])
    .optional(),
  newProblemLogic: unknownableString.nullable().optional(),
  hallucinatedCapability: z.string().trim().min(1).max(128).nullable().optional(),
  confidence: aiConfidenceSchema.default(0.7),
  evidence: z.string().trim().min(1).max(2_000).optional(),
});

export const capabilityRecommendationSpecSchema = z
  .object({
    problemSummary: unknownableString.optional(),
    users: unknownableListSchema.optional(),
    actors: unknownableListSchema.optional(),
    workflows: unknownableListSchema.optional(),
    entities: unknownableListSchema.optional(),
    businessRules: unknownableListSchema.optional(),
    integrations: unknownableListSchema.optional(),
    odooRequirements: unknownableListSchema.optional(),
    aiRequirements: unknownableListSchema.optional(),
    automationRequirements: unknownableListSchema.optional(),
    notifications: unknownableListSchema.optional(),
    documents: unknownableListSchema.optional(),
    reports: unknownableListSchema.optional(),
    securityRequirements: unknownableListSchema.optional(),
    nonFunctionalRequirements: unknownableListSchema.optional(),
    likelyDataRequirements: unknownableListSchema.optional(),
    likelyInfrastructureRequirements: unknownableListSchema.optional(),
  })
  .passthrough();

export const capabilityRecommendationAnalysisSchema = z
  .object({
    spec: capabilityRecommendationSpecSchema.optional(),
    mappings: z.array(recommendationMappingSchema).max(80).default([]),
    existingCapabilities: z
      .array(
        z.object({
          name: z.string().trim().min(1).max(128),
          summary: z.string().trim().min(1).max(500).optional(),
          requirements: z.array(z.string().trim().min(1).max(500)).max(40).optional(),
        }),
      )
      .max(80)
      .optional(),
    newProblemLogic: z
      .array(
        z.object({
          requirement: z.string().trim().min(1).max(500),
          logic: z.string().trim().min(1).max(2_000),
        }),
      )
      .max(80)
      .optional(),
    unknowns: z.array(z.string().trim().min(1).max(200)).max(40).optional(),
    uncertainty: z.array(z.string().trim().min(1).max(500)).max(30).optional(),
    problemSummary: unknownableString.optional(),
  })
  .passthrough();

export const capabilityRecommendBodySchema = z.object({
  analysis: capabilityRecommendationAnalysisSchema,
  title: z.string().trim().min(1).max(200).optional(),
});

export type CapabilityRecommendBody = z.infer<typeof capabilityRecommendBodySchema>;
