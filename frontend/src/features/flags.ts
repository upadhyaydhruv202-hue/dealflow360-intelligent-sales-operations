import {
  DISABLED_FEATURE_STATE,
  FEATURE_NAMES,
  isFeatureName,
  isPublicDemoMode,
  isPublicFeatureEnabled,
} from '@hackathon/api-contract';
import type { FeatureName, PublicFeatureState } from '@hackathon/api-contract';

export { DISABLED_FEATURE_STATE, FEATURE_NAMES, isFeatureName };
export type { FeatureName, PublicFeatureState };

export function isFeatureEnabled(state: PublicFeatureState, name: string): boolean {
  return isPublicFeatureEnabled(state, name);
}

export function isDemoMode(state: PublicFeatureState): boolean {
  return isPublicDemoMode(state);
}
