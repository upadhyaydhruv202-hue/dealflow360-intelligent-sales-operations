import pino from 'pino';
import { describe, expect, it } from 'vitest';

import { loadConfig } from '../config';
import { ValidationError } from '../errors';
import { createEventBus } from '../events';
import { InMemoryJobQueue } from '../jobs';
import { definePlatformPlugin, applyPlatformPlugins } from '../platform';
import { createPlatformCapabilityRegistry, discoverCapabilities } from './index';
import { defineCapability } from './catalog/define';

const logger = pino({ level: 'silent' });

function pluginContext() {
  return {
    role: 'api' as const,
    config: loadConfig({ NODE_ENV: 'test' }),
    logger,
    jobs: new InMemoryJobQueue(logger),
    events: createEventBus(logger),
    scheduler: null,
    registries: {
      copilot: null,
      intents: null,
      odooCapabilities: null,
      automation: null,
      reports: null,
    },
    capabilities: createPlatformCapabilityRegistry(),
  };
}

const extraCapability = defineCapability({
  name: 'plugin.extra',
  kind: 'application',
  category: 'core',
  maturity: 'beta',
  summary: 'Capability contributed by a platform plugin.',
  documentation: ['docs/problem-module.md'],
  defaultEnabled: true,
});

describe('platform plugin capability registration', () => {
  it('registers static plugin capabilities without constructing services', () => {
    const plugin = definePlatformPlugin({
      name: 'test.plugin',
      capabilities: [extraCapability],
    });

    const discovered = discoverCapabilities({ plugins: [plugin] });
    expect(
      discovered.some((capability) => capability.name === 'plugin.extra' && capability.enabled),
    ).toBe(true);
  });

  it('registers plugin capabilities onto the live registry', () => {
    const ctx = pluginContext();
    const plugin = definePlatformPlugin({
      name: 'test.live',
      capabilities: [extraCapability],
      register(context) {
        expect(context.capabilities.has('plugin.extra')).toBe(true);
        context.capabilities.register(
          defineCapability({
            name: 'plugin.runtime',
            kind: 'application',
            category: 'core',
            maturity: 'experimental',
            summary: 'Registered from plugin.register without booting AI or Odoo.',
            documentation: ['docs/problem-module.md'],
            defaultEnabled: false,
          }),
        );
      },
    });

    const names = applyPlatformPlugins([plugin], ctx);
    expect(names).toEqual(['test.live']);
    expect(plugin.version).toBe('0.1.0');
    expect(ctx.capabilities.has('plugin.extra')).toBe(true);
    expect(ctx.capabilities.has('plugin.runtime')).toBe(true);
    expect(ctx.capabilities.discover(ctx.config, { name: 'plugin.runtime' })[0]?.enabled).toBe(
      false,
    );
  });

  it('rejects duplicate plugin names', () => {
    const plugin = definePlatformPlugin({
      name: 'test.dup',
      register() {},
    });
    expect(() => applyPlatformPlugins([plugin, plugin], pluginContext())).toThrow(ValidationError);
  });

  it('rejects duplicate capability names from a plugin', () => {
    const plugin = definePlatformPlugin({
      name: 'test.auth.dup',
      capabilities: [
        defineCapability({
          name: 'auth',
          kind: 'application',
          category: 'core',
          maturity: 'stable',
          summary: 'Duplicate of the platform catalog auth capability.',
          documentation: ['docs/auth.md'],
        }),
      ],
    });
    expect(() => applyPlatformPlugins([plugin], pluginContext())).toThrow(ValidationError);
  });

  it('rejects an invalid plugin version', () => {
    expect(() =>
      definePlatformPlugin({
        name: 'test.version',
        version: 'v1.0.0',
      }),
    ).toThrow(ValidationError);
  });
});
