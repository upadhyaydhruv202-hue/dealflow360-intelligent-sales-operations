import { z } from 'zod';

import { capabilityRecommendationAnalysisSchema } from '../capability-recommendations';
import { PROBLEM_INTELLIGENCE, PROJECT_PLANNING } from '../constants';

export const projectPlanningAnalyzeBodySchema = z.object({
  statement: z.string().trim().min(1).max(PROBLEM_INTELLIGENCE.MAX_STATEMENT_CHARS),
  title: z.string().trim().min(1).max(PROJECT_PLANNING.MAX_TITLE_CHARS).optional(),
});

export const projectPlanningSelectionBodySchema = z.object({
  title: z.string().trim().min(1).max(PROJECT_PLANNING.MAX_TITLE_CHARS).optional(),
  statement: z.string().trim().min(1).max(PROBLEM_INTELLIGENCE.MAX_STATEMENT_CHARS).optional(),
  analysis: capabilityRecommendationAnalysisSchema.optional(),
  capabilities: z
    .array(z.string().trim().min(1).max(128))
    .max(PROJECT_PLANNING.MAX_CAPABILITIES)
    .default([]),
  profiles: z.array(z.string().trim().min(1).max(128)).max(PROJECT_PLANNING.MAX_PROFILES).default([]),
  architectureMode: z.string().trim().min(1).max(128).optional(),
  deploymentMode: z.string().trim().min(1).max(128).optional(),
  includeOptional: z.boolean().optional(),
  closeDependencies: z.boolean().optional(),
});

export type ProjectPlanningAnalyzeBody = z.infer<typeof projectPlanningAnalyzeBodySchema>;
export type ProjectPlanningSelectionBody = z.infer<typeof projectPlanningSelectionBodySchema>;
