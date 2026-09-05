import { describe, expect, it } from 'vitest';

import { loadConfig } from '../config';
import { FEATURE_NAMES } from '../features/registry';
import { PLATFORM_CAPABILITIES } from './catalog';
import { discoverCapabilities } from './discover';
import { capabilityDefinitionSchema } from './schema';

describe('capability discovery', () => {
  it('lists the platform catalog without constructing services', () => {
    const discovered = discoverCapabilities();
    const names = discovered.map((capability) => capability.name);

    expect(names).toContain('auth');
    expect(names).toContain('ai');
    expect(names).toContain('adapter.ai.gemini');
    expect(names).toContain('architecture.modular-monolith');
    expect(names).toContain('deployment.docker-compose');
    expect(discovered.every((capability) => typeof capability.enabled === 'boolean')).toBe(true);
  });

  it('marks feature-flagged capabilities disabled when the flag is off', () => {
    const config = loadConfig({ NODE_ENV: 'test', APP_NAME: 'Hackathon Starter Kit' });
    const discovered = discoverCapabilities({ config });
    const byName = Object.fromEntries(discovered.map((capability) => [capability.name, capability]));

    expect(config.features.rag).toBe(false);
    expect(config.features.copilot).toBe(false);
    expect(config.features.pdf).toBe(true);
    expect(byName.rag.enabled).toBe(false);
    expect(byName.copilot.enabled).toBe(false);
    expect(byName.ai.enabled).toBe(false);
    expect(byName.realtime.enabled).toBe(false);
    expect(byName.search.enabled).toBe(false);
    expect(byName.analytics.enabled).toBe(false);
    expect(byName.pdf.enabled).toBe(true);
    expect(byName.auth.enabled).toBe(true);
  });

  it('marks feature-flagged capabilities enabled when the flag is on', () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      APP_NAME: 'Hackathon Starter Kit',
      FEATURE_RAG: 'true',
      FEATURE_AI: 'true',
      AI_PROVIDER: 'mock',
    });
    const discovered = discoverCapabilities({ config, includeDisabled: false });

    expect(discovered.some((capability) => capability.name === 'rag' && capability.enabled)).toBe(true);
    expect(discovered.some((capability) => capability.name === 'ai')).toBe(true);
    expect(discovered.some((capability) => capability.name === 'copilot')).toBe(false);
  });

  it('does not AND optional AI dependencies for anomaly', () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      FEATURE_ANOMALY_DETECTION: 'true',
      FEATURE_AI: 'false',
    });
    const anomaly = discoverCapabilities({ config }).find((capability) => capability.name === 'anomaly');
    const ai = discoverCapabilities({ config }).find((capability) => capability.name === 'ai');

    expect(anomaly?.enabled).toBe(true);
    expect(ai?.enabled).toBe(false);
    expect(anomaly?.optionalDependencies).toContain('ai');
  });

  it('does not require AI for optional analytics', () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      FEATURE_ANALYTICS: 'true',
      FEATURE_AI: 'false',
    });
    const analytics = discoverCapabilities({ config }).find((capability) => capability.name === 'analytics');
    const ai = discoverCapabilities({ config }).find((capability) => capability.name === 'ai');

    expect(analytics?.enabled).toBe(true);
    expect(ai?.enabled).toBe(false);
  });

  it('does not require AI for optional search', () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      FEATURE_SEARCH: 'true',
      FEATURE_AI: 'false',
    });
    const search = discoverCapabilities({ config }).find((capability) => capability.name === 'search');
    const ai = discoverCapabilities({ config }).find((capability) => capability.name === 'ai');

    expect(search?.enabled).toBe(true);
    expect(ai?.enabled).toBe(false);
  });

  it('does not require AI for optional realtime', () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      FEATURE_REALTIME: 'true',
      FEATURE_AI: 'false',
    });
    const realtime = discoverCapabilities({ config }).find((capability) => capability.name === 'realtime');
    const ai = discoverCapabilities({ config }).find((capability) => capability.name === 'ai');

    expect(realtime?.enabled).toBe(true);
    expect(ai?.enabled).toBe(false);
  });

  it('filters disabled capabilities when includeDisabled is false', () => {
    const config = loadConfig({ NODE_ENV: 'test' });
    const enabledOnly = discoverCapabilities({ config, includeDisabled: false });
    expect(enabledOnly.every((capability) => capability.enabled)).toBe(true);
    expect(enabledOnly.some((capability) => capability.name === 'rag')).toBe(false);
  });
});

describe('platform catalog', () => {
  it('validates every catalog entry and never marks capabilities enterprise', () => {
    const names = new Set<string>();
    for (const capability of PLATFORM_CAPABILITIES) {
      const parsed = capabilityDefinitionSchema.parse(capability);
      expect(parsed.maturity).not.toBe('enterprise');
      expect(names.has(parsed.name)).toBe(false);
      names.add(parsed.name);
    }

    expect(PLATFORM_CAPABILITIES.some((capability) => capability.kind === 'application')).toBe(true);
    expect(PLATFORM_CAPABILITIES.some((capability) => capability.kind === 'infrastructure')).toBe(true);
    expect(PLATFORM_CAPABILITIES.some((capability) => capability.kind === 'adapter')).toBe(true);
    expect(PLATFORM_CAPABILITIES.some((capability) => capability.kind === 'architecture-mode')).toBe(true);
    expect(PLATFORM_CAPABILITIES.some((capability) => capability.kind === 'deployment-mode')).toBe(true);
  });

  it('records FEATURE_* flags without replacing FEATURE_REGISTRY', () => {
    const flagged = new Set(
      PLATFORM_CAPABILITIES.map((capability) => capability.featureFlag).filter(Boolean),
    );
    for (const name of FEATURE_NAMES) {
      if (name === 'notifications' || name === 's3') {
        continue;
      }
      expect(flagged.has(name), `missing featureFlag mapping for ${name}`).toBe(true);
    }
  });
});
