import { z } from 'zod';

import {
  CAPABILITY_CATEGORIES,
  CAPABILITY_KINDS,
  CAPABILITY_MATURITIES,
} from './types';
import { CAPABILITY_VERSION_PATTERN } from './version';

export const capabilityNameSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(
    /^[a-z][a-z0-9._-]*$/,
    'Capability names must be lowercase dotted identifiers (letters, digits, ".", "_" or "-")',
  );

export const capabilityVersionSchema = z
  .string()
  .regex(
    CAPABILITY_VERSION_PATTERN,
    'Version must be major.minor.patch with an optional prerelease (no leading v)',
  );

export const capabilityKindSchema = z.enum(CAPABILITY_KINDS);
export const capabilityMaturitySchema = z.enum(CAPABILITY_MATURITIES);
export const capabilityCategorySchema = z.enum(CAPABILITY_CATEGORIES);

const stringList = z.array(z.string().min(1).max(256)).max(64);

export const capabilityDefinitionSchema = z.object({
  name: capabilityNameSchema,
  version: capabilityVersionSchema,
  kind: capabilityKindSchema,
  category: capabilityCategorySchema,
  maturity: capabilityMaturitySchema,
  summary: z.string().trim().min(1).max(500),
  dependencies: stringList,
  optionalDependencies: stringList,
  conflicts: stringList,
  environmentRequirements: stringList,
  infrastructureRequirements: stringList,
  providerRequirements: stringList,
  permissions: stringList,
  architectureCompatibility: stringList.min(1),
  deploymentCompatibility: stringList.min(1),
  frontendAvailability: z.boolean(),
  backendAvailability: z.boolean(),
  workerRequirement: z.boolean(),
  databaseRequirement: z.boolean(),
  tests: stringList,
  documentation: stringList.min(1),
  featureFlag: z.string().min(1).max(64).optional(),
  defaultEnabled: z.boolean().optional(),
});

export type ParsedCapabilityDefinition = z.infer<typeof capabilityDefinitionSchema>;
