import { describe, expect, it } from 'vitest';

import {
  DISABLED_FEATURE_STATE,
  FEATURE_NAMES,
  emptyFeatureMap,
  featureNameSchema,
  isFeatureName,
  isPublicDemoMode,
  isPublicFeatureEnabled,
  publicFeatureStateSchema,
} from './features';

describe('shared feature names', () => {
  it('lists unique camelCase names used by GET /api/v1/features', () => {
    expect(new Set(FEATURE_NAMES).size).toBe(FEATURE_NAMES.length);
    expect(FEATURE_NAMES).toContain('ai');
    expect(FEATURE_NAMES).toContain('realtime');
    expect(FEATURE_NAMES).toContain('search');
    expect(FEATURE_NAMES).toContain('analytics');
    expect(FEATURE_NAMES).toContain('pdf');
    expect(featureNameSchema.parse('copilot')).toBe('copilot');
    expect(featureNameSchema.safeParse('FEATURE_AI').success).toBe(false);
  });

  it('treats missing snapshot keys as disabled', () => {
    expect(isFeatureName('copilot')).toBe(true);
    expect(isFeatureName('not-a-real-flag')).toBe(false);
    expect(isPublicFeatureEnabled(DISABLED_FEATURE_STATE, 'ai')).toBe(false);
    expect(isPublicDemoMode(DISABLED_FEATURE_STATE)).toBe(false);
    expect(emptyFeatureMap().pdf).toBe(false);
    expect(publicFeatureStateSchema.parse({ demoMode: true, features: { ai: true } })).toEqual({
      demoMode: true,
      features: { ai: true },
    });
  });
});
