import { FEATURE_NAMES as CONTRACT_FEATURE_NAMES } from '@hackathon/api-contract';
import { describe, expect, it } from 'vitest';

import { loadConfig } from '../config';
import { ERROR_CODES } from '../constants';
import { FeatureDisabledError } from '../errors';
import {
  FEATURE_NAMES,
  FEATURE_REGISTRY,
  getPublicFeatureState,
  isDemoMode,
  isFeatureEnabled,
  listFeatureRegistry,
  requireEnabledService,
  requireFeature,
  resolveDemoMode,
  shouldMockExternalIntegrations,
  shouldRelaxSeededDemoLoginRateLimit,
  shouldSeedDemoDataFromEnv,
  isSeededDemoAccountEmail,
} from './index';
import { requireFeature as requireFeatureMiddleware } from './middleware';

const productionSecrets = {
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  STORAGE_SIGNING_SECRET: 'c'.repeat(32),
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/hackathon',
  REDIS_URL: 'redis://localhost:6379',
};

describe('isFeatureEnabled', () => {
  it('returns true for an enabled flag', () => {
    const config = loadConfig({ NODE_ENV: 'test', FEATURE_AI: 'true', AI_PROVIDER: 'mock' });
    expect(isFeatureEnabled(config, 'ai')).toBe(true);
  });

  it('returns false for a disabled flag', () => {
    const config = loadConfig({ NODE_ENV: 'test', FEATURE_ODOO: 'false' });
    expect(isFeatureEnabled(config, 'odoo')).toBe(false);
  });

  it('returns false when a flag is missing', () => {
    const config = loadConfig({ NODE_ENV: 'test' });
    expect(isFeatureEnabled(config, 'sms')).toBe(false);
    expect(isFeatureEnabled(config, 'copilot')).toBe(false);
    expect(isFeatureEnabled(config, 'intents')).toBe(false);
    expect(isFeatureEnabled(config, 'problemIntelligence')).toBe(false);
    expect(isFeatureEnabled(config, 'capabilityRecommendations')).toBe(false);
    expect(isFeatureEnabled(config, 'projectPlanning')).toBe(false);
    expect(isFeatureEnabled(config, 'projectGenerator')).toBe(false);
    expect(isFeatureEnabled(config, 'rag')).toBe(false);
    expect(isFeatureEnabled(config, 'anomalyDetection')).toBe(false);
    expect(isFeatureEnabled(config, 'realtime')).toBe(false);
    expect(isFeatureEnabled(config, 'search')).toBe(false);
    expect(isFeatureEnabled(config, 'analytics')).toBe(false);
    expect(isFeatureEnabled(config, 'pdf')).toBe(true);
  });

  it('enables project planning without FEATURE_AI', () => {
    const config = loadConfig({ NODE_ENV: 'test', FEATURE_PROJECT_PLANNING: 'true' });
    expect(isFeatureEnabled(config, 'projectPlanning')).toBe(true);
    expect(isFeatureEnabled(config, 'ai')).toBe(false);
    expect(FEATURE_REGISTRY.projectPlanning.dependencies).toEqual([]);
  });

  it('enables the project generator without FEATURE_AI', () => {
    const config = loadConfig({ NODE_ENV: 'test', FEATURE_PROJECT_GENERATOR: 'true' });
    expect(isFeatureEnabled(config, 'projectGenerator')).toBe(true);
    expect(isFeatureEnabled(config, 'ai')).toBe(false);
    expect(FEATURE_REGISTRY.projectGenerator.dependencies).toEqual([]);
  });

  it('enables capability recommendations without FEATURE_AI', () => {
    const config = loadConfig({ NODE_ENV: 'test', FEATURE_CAPABILITY_RECOMMENDATIONS: 'true' });
    expect(isFeatureEnabled(config, 'capabilityRecommendations')).toBe(true);
    expect(isFeatureEnabled(config, 'ai')).toBe(false);
    expect(FEATURE_REGISTRY.capabilityRecommendations.dependencies).toEqual([]);
  });

  it('enables optional analytics without FEATURE_AI', () => {
    const config = loadConfig({ NODE_ENV: 'test', FEATURE_ANALYTICS: 'true' });
    expect(isFeatureEnabled(config, 'analytics')).toBe(true);
    expect(isFeatureEnabled(config, 'ai')).toBe(false);
    expect(FEATURE_REGISTRY.analytics.dependencies).toEqual([]);
  });

  it('enables optional search without FEATURE_AI', () => {
    const config = loadConfig({ NODE_ENV: 'test', FEATURE_SEARCH: 'true' });
    expect(isFeatureEnabled(config, 'search')).toBe(true);
    expect(isFeatureEnabled(config, 'ai')).toBe(false);
    expect(FEATURE_REGISTRY.search.dependencies).toEqual([]);
  });

  it('enables optional realtime without FEATURE_AI', () => {
    const config = loadConfig({ NODE_ENV: 'test', FEATURE_REALTIME: 'true' });
    expect(isFeatureEnabled(config, 'realtime')).toBe(true);
    expect(isFeatureEnabled(config, 'ai')).toBe(false);
    expect(FEATURE_REGISTRY.realtime.dependencies).toEqual([]);
  });

  it('enables anomaly detection without FEATURE_AI', () => {
    const config = loadConfig({ NODE_ENV: 'test', FEATURE_ANOMALY_DETECTION: 'true' });
    expect(isFeatureEnabled(config, 'anomalyDetection')).toBe(true);
    expect(isFeatureEnabled(config, 'ai')).toBe(false);
    expect(FEATURE_REGISTRY.anomalyDetection.dependencies).toEqual([]);
  });

  it('can disable PDF HTTP when FEATURE_PDF is false', () => {
    const config = loadConfig({ NODE_ENV: 'test', FEATURE_PDF: 'false' });
    expect(isFeatureEnabled(config, 'pdf')).toBe(false);
  });

  it('returns false for an unknown flag name', () => {
    const config = loadConfig({ NODE_ENV: 'test', FEATURE_AI: 'true', AI_PROVIDER: 'mock' });
    expect(isFeatureEnabled(config, 'not-a-real-flag')).toBe(false);
  });

  it('treats legacy AI_ENABLED as FEATURE_AI', () => {
    const config = loadConfig({ NODE_ENV: 'test', AI_ENABLED: 'true', AI_PROVIDER: 'mock' });
    expect(isFeatureEnabled(config, 'ai')).toBe(true);
    expect(config.features.ai).toBe(true);
  });
});

describe('isDemoMode', () => {
  it('is true when DEMO_MODE is set', () => {
    const config = loadConfig({ NODE_ENV: 'test', DEMO_MODE: 'true' });
    expect(isDemoMode(config)).toBe(true);
    expect(shouldMockExternalIntegrations(config)).toBe(true);
  });

  it('defaults to true outside production when DEMO_MODE is missing', () => {
    expect(resolveDemoMode({ NODE_ENV: 'development' })).toBe(true);
    expect(resolveDemoMode({ NODE_ENV: 'test' })).toBe(true);
    expect(isDemoMode(loadConfig({ NODE_ENV: 'test' }))).toBe(true);
  });

  it('is false in production unless DEMO_MODE is explicitly true', () => {
    const config = loadConfig({
      NODE_ENV: 'production',
      DEMO_MODE: 'false',
      FEATURE_AI: 'false',
      ...productionSecrets,
    });
    expect(isDemoMode(config)).toBe(false);
    expect(shouldMockExternalIntegrations(config)).toBe(false);
    expect(resolveDemoMode({ NODE_ENV: 'production' })).toBe(false);
  });
});

describe('requireFeature', () => {
  it('throws FEATURE_DISABLED when the flag is off', () => {
    const config = loadConfig({ NODE_ENV: 'test', FEATURE_COPILOT: 'false' });
    expect(() => requireFeature(config, 'copilot')).toThrow(FeatureDisabledError);
    try {
      requireFeature(config, 'copilot');
    } catch (error) {
      expect(error).toMatchObject({
        code: ERROR_CODES.FEATURE_DISABLED,
        statusCode: 404,
        details: { feature: 'copilot' },
      });
    }
  });

  it('does not throw when the flag is on', () => {
    const config = loadConfig({ NODE_ENV: 'test', FEATURE_AUTOMATION: 'true' });
    expect(() => requireFeature(config, 'automation')).not.toThrow();
  });
});

describe('seeded demo login rate-limit relaxation', () => {
  it('recognizes only the four seeded demo emails', () => {
    expect(isSeededDemoAccountEmail('demo.staff@example.com')).toBe(true);
    expect(isSeededDemoAccountEmail('  Demo.Admin@example.com ')).toBe(true);
    expect(isSeededDemoAccountEmail('limited@example.com')).toBe(false);
    expect(isSeededDemoAccountEmail('')).toBe(false);
  });

  it('relaxes login throttling only for seeded emails while DEMO_MODE is on', () => {
    expect(
      shouldRelaxSeededDemoLoginRateLimit({ demoMode: true }, 'demo.staff@example.com'),
    ).toBe(true);
    expect(
      shouldRelaxSeededDemoLoginRateLimit({ demoMode: true }, 'limited@example.com'),
    ).toBe(false);
    expect(
      shouldRelaxSeededDemoLoginRateLimit({ demoMode: false }, 'demo.staff@example.com'),
    ).toBe(false);
  });
});

describe('demo seed and public snapshot', () => {
  it('seeds demo data only when demo mode is on', () => {
    expect(shouldSeedDemoDataFromEnv({ NODE_ENV: 'development', DEMO_MODE: 'true' })).toBe(true);
    expect(shouldSeedDemoDataFromEnv({ NODE_ENV: 'production', DEMO_MODE: 'false' })).toBe(false);
    expect(shouldSeedDemoDataFromEnv({ NODE_ENV: 'production' })).toBe(false);
  });

  it('returns a public snapshot without secrets', () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      DEMO_MODE: 'true',
      FEATURE_AI: 'true',
      FEATURE_SMS: 'false',
      AI_PROVIDER: 'mock',
      GEMINI_API_KEY: 'secret-key',
    });
    const snapshot = getPublicFeatureState(config);
    expect(snapshot.demoMode).toBe(true);
    expect(snapshot.features.ai).toBe(true);
    expect(snapshot.features.sms).toBe(false);
    expect(JSON.stringify(snapshot)).not.toContain('secret-key');
  });
});

describe('feature registry', () => {
  it('lists every flag with default, dependencies, and purpose', () => {
    const listed = listFeatureRegistry();
    expect(listed.length).toBe(FEATURE_NAMES.length);
    for (const entry of listed) {
      expect(entry.envVar.startsWith('FEATURE_')).toBe(true);
      expect(typeof entry.default).toBe('boolean');
      expect(Array.isArray(entry.dependencies)).toBe(true);
      expect(entry.purpose.length).toBeGreaterThan(8);
      expect(FEATURE_REGISTRY[entry.name].envVar).toBe(entry.envVar);
    }
  });

  it('uses the shared contract FEATURE_NAMES list', () => {
    expect([...FEATURE_NAMES]).toEqual([...CONTRACT_FEATURE_NAMES]);
    expect(Object.keys(FEATURE_REGISTRY)).toEqual([...FEATURE_NAMES]);
  });
});

describe('requireFeature middleware', () => {
  it('calls next with FeatureDisabledError when the flag is off', () => {
    const config = loadConfig({ NODE_ENV: 'test', FEATURE_ODOO: 'false' });
    const handler = requireFeatureMiddleware(config, 'odoo');
    let passed: unknown;
    handler({} as never, {} as never, (error?: unknown) => {
      passed = error;
    });
    expect(passed).toBeInstanceOf(FeatureDisabledError);
  });

  it('calls next without an error when the flag is on', () => {
    const config = loadConfig({ NODE_ENV: 'test', FEATURE_ODOO: 'true' });
    const handler = requireFeatureMiddleware(config, 'odoo');
    let passed: unknown = 'unset';
    handler({} as never, {} as never, (error?: unknown) => {
      passed = error;
    });
    expect(passed).toBeUndefined();
  });
});

describe('requireEnabledService', () => {
  it('returns the service when it exists', () => {
    expect(requireEnabledService({ ok: true }, 'pdf')).toEqual({ ok: true });
  });

  it('throws FEATURE_DISABLED when the service is missing', () => {
    expect(() => requireEnabledService(null, 'copilot')).toThrow(FeatureDisabledError);
  });
});
