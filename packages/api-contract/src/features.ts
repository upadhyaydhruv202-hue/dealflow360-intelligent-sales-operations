import { z } from 'zod';

export const FEATURE_NAMES = [
  'ai',
  'odoo',
  'automation',
  'notifications',
  'otp',
  'sms',
  's3',
  'rag',
  'copilot',
  'intents',
  'problemIntelligence',
  'capabilityRecommendations',
  'projectPlanning',
  'projectGenerator',
  'anomalyDetection',
  'realtime',
  'search',
  'analytics',
  'pdf',
] as const;

export type FeatureName = (typeof FEATURE_NAMES)[number];

export const featureNameSchema = z.enum(FEATURE_NAMES);

export type FeatureMap = Record<FeatureName, boolean>;

export const publicFeatureStateSchema = z.object({
  demoMode: z.boolean(),
  features: z.record(z.boolean()),
});

export type PublicFeatureState = z.infer<typeof publicFeatureStateSchema>;

export const DISABLED_FEATURE_STATE: PublicFeatureState = {
  demoMode: false,
  features: {},
};

export function isFeatureName(value: string): value is FeatureName {
  return (FEATURE_NAMES as readonly string[]).includes(value);
}

export function emptyFeatureMap(): FeatureMap {
  return FEATURE_NAMES.reduce((acc, name) => {
    acc[name] = false;
    return acc;
  }, {} as FeatureMap);
}

export function isPublicFeatureEnabled(state: PublicFeatureState, name: string): boolean {
  return state.features[name] === true;
}

export function isPublicDemoMode(state: PublicFeatureState): boolean {
  return state.demoMode === true;
}
