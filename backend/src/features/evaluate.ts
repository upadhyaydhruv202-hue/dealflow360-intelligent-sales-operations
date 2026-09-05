import { FeatureDisabledError } from '../errors';
import type { AppConfig } from '../types/config';
import {
  DISABLED_FEATURES,
  FEATURE_REGISTRY,
  isFeatureName,
  type FeatureMap,
  type FeatureName,
} from './registry';

export interface FeatureConfig {
  demoMode: boolean;
  features: FeatureMap;
}

export interface PublicFeatureState {
  demoMode: boolean;
  features: FeatureMap;
}

export function isDemoMode(config: Pick<FeatureConfig, 'demoMode'>): boolean {
  return config.demoMode === true;
}

export function isFeatureEnabled(config: Pick<FeatureConfig, 'features'>, name: string): boolean {
  if (!isFeatureName(name)) {
    return false;
  }

  return config.features[name] === true;
}

export function requireFeature(config: Pick<FeatureConfig, 'features'>, name: string): void {
  if (!isFeatureEnabled(config, name)) {
    throw new FeatureDisabledError(name);
  }
}

export function requireEnabledService<T>(service: T | null | undefined, name: FeatureName): T {
  if (service == null) {
    throw new FeatureDisabledError(name);
  }

  return service;
}

export function getPublicFeatureState(config: FeatureConfig): PublicFeatureState {
  return {
    demoMode: isDemoMode(config),
    features: { ...config.features },
  };
}

export function emptyFeatureMap(): FeatureMap {
  return { ...DISABLED_FEATURES };
}

export function featureLabel(name: FeatureName): string {
  return FEATURE_REGISTRY[name].envVar;
}

export function toFeatureConfig(config: Pick<AppConfig, 'demoMode' | 'features'>): FeatureConfig {
  return {
    demoMode: config.demoMode,
    features: config.features,
  };
}
