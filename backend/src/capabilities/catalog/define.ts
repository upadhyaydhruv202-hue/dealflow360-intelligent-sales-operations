import type { CapabilityDefinition } from '../types';
import {
  DEFAULT_ARCHITECTURE_MODE,
  DEFAULT_DEPLOYMENT_MODES,
} from '../types';
import { CAPABILITY_VERSION } from '../version';

export function defineCapability(
  definition: Pick<
    CapabilityDefinition,
    'name' | 'kind' | 'category' | 'maturity' | 'summary' | 'documentation'
  > &
    Partial<CapabilityDefinition>,
): CapabilityDefinition {
  return {
    version: CAPABILITY_VERSION,
    dependencies: [],
    optionalDependencies: [],
    conflicts: [],
    environmentRequirements: [],
    infrastructureRequirements: [],
    providerRequirements: [],
    permissions: [],
    architectureCompatibility: [DEFAULT_ARCHITECTURE_MODE],
    deploymentCompatibility: [...DEFAULT_DEPLOYMENT_MODES],
    frontendAvailability: false,
    backendAvailability: true,
    workerRequirement: false,
    databaseRequirement: false,
    tests: [],
    defaultEnabled: true,
    ...definition,
  };
}
