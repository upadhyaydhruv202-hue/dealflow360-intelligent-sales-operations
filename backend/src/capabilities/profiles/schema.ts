import { z } from 'zod';

import { capabilityMaturitySchema, capabilityNameSchema, capabilityVersionSchema } from '../schema';

const stringList = z.array(z.string().min(1).max(256)).max(64);
const nameList = z.array(capabilityNameSchema).max(64);

export const versionRangeSchema = z.string().trim().min(1).max(128);

export const versionCompatibilitySchema = z.object({
  platform: versionRangeSchema.optional(),
  capabilities: z.record(capabilityNameSchema, versionRangeSchema).optional(),
  profiles: z.record(capabilityNameSchema, versionRangeSchema).optional(),
  plugins: z.record(capabilityNameSchema, versionRangeSchema).optional(),
});

export const unsupportedCombinationSchema = z
  .object({
    profiles: nameList.optional(),
    capabilities: nameList.optional(),
    architectureModes: stringList.optional(),
    deploymentModes: stringList.optional(),
    message: z.string().trim().min(1).max(500),
  })
  .refine(
    (value) =>
      (value.profiles?.length ?? 0) +
        (value.capabilities?.length ?? 0) +
        (value.architectureModes?.length ?? 0) +
        (value.deploymentModes?.length ?? 0) >
      0,
    { message: 'An unsupported combination must name at least one profile, capability, or mode' },
  );

export const projectProfileSchema = z.object({
  name: capabilityNameSchema,
  title: z.string().trim().min(1).max(80),
  version: capabilityVersionSchema,
  maturity: capabilityMaturitySchema,
  summary: z.string().trim().min(1).max(500),
  includes: nameList,
  capabilities: nameList,
  optionalCapabilities: nameList,
  conflicts: nameList,
  conflictingProfiles: nameList,
  architectureCompatibility: stringList.min(1),
  deploymentCompatibility: stringList.min(1),
  compatibility: versionCompatibilitySchema,
  incompatibleWith: z.array(unsupportedCombinationSchema).max(16),
  requiredPlugins: nameList,
  tests: stringList,
  documentation: stringList.min(1),
});

export type ParsedProjectProfile = z.infer<typeof projectProfileSchema>;
