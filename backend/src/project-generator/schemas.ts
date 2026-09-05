import { z } from 'zod';

import { PROJECT_PLANNING } from '../constants';
import { PROBLEM_INTELLIGENCE } from '../constants';

export const projectGeneratorConfigurationSchema = z
  .object({
    id: z.string().trim().min(1).max(128).optional(),
    approved: z.literal(true),
    status: z.literal('approved').optional(),
    platformVersion: z.string().trim().min(1).max(32).optional(),
    catalogVersion: z.string().trim().min(1).max(32).optional(),
    title: z.string().trim().min(1).max(PROJECT_PLANNING.MAX_TITLE_CHARS).nullable().optional(),
    problemSummary: z
      .string()
      .trim()
      .min(1)
      .max(PROBLEM_INTELLIGENCE.MAX_STATEMENT_CHARS)
      .nullable()
      .optional(),
    proposed: z.object({
      capabilities: z.array(z.string().trim().min(1).max(128)).max(PROJECT_PLANNING.MAX_CAPABILITIES),
      profiles: z.array(z.string().trim().min(1).max(128)).max(PROJECT_PLANNING.MAX_PROFILES),
      architectureMode: z.string().trim().min(1).max(128),
      deploymentMode: z.string().trim().min(1).max(128),
      includeOptional: z.boolean(),
      closeDependencies: z.boolean(),
    }),
    integrity: z
      .object({
        algorithm: z.literal('sha256').optional(),
        digest: z.string().regex(/^[a-f0-9]{64}$/),
      })
      .optional(),
    approvedAt: z.string().trim().min(1).max(64).nullable().optional(),
    approvedBy: z.string().trim().min(1).max(128).nullable().optional(),
    requirements: z.array(z.unknown()).max(200).optional(),
  });

export const projectGeneratorBodySchema = z
  .object({
    configuration: projectGeneratorConfigurationSchema,
    dryRun: z.boolean().optional(),
    overwrite: z.boolean().optional(),
  })
  .strict();

export type ProjectGeneratorBody = z.infer<typeof projectGeneratorBodySchema>;
