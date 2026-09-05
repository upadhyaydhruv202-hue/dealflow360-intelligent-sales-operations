import { DEFAULT_ARCHITECTURE_MODE, DEFAULT_DEPLOYMENT_MODES } from '../types';
import { PLATFORM_VERSION, PROFILE_VERSION } from '../version';
import type { ProjectProfile } from './types';

export function defineProfile(
  definition: Pick<ProjectProfile, 'name' | 'title' | 'maturity' | 'summary' | 'documentation'> &
    Partial<ProjectProfile>,
): ProjectProfile {
  return {
    version: PROFILE_VERSION,
    includes: [],
    capabilities: [],
    optionalCapabilities: [],
    conflicts: [],
    conflictingProfiles: [],
    architectureCompatibility: [DEFAULT_ARCHITECTURE_MODE],
    deploymentCompatibility: [...DEFAULT_DEPLOYMENT_MODES],
    compatibility: {
      platform: `>=${PLATFORM_VERSION} <1.0.0`,
    },
    incompatibleWith: [],
    requiredPlugins: [],
    tests: ['backend/src/capabilities/profiles/resolve.test.ts'],
    ...definition,
  };
}
