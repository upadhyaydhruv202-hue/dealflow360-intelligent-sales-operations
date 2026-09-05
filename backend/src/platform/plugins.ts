import {
  isValidPluginVersion,
  PLUGIN_VERSION,
  registerContributorCapabilities,
} from '../capabilities';
import { ValidationError } from '../errors';
import type { ApplyPlatformPluginsOptions, PlatformPlugin, PlatformPluginContext } from './types';

const PLUGIN_NAME_PATTERN = /^[a-z][a-z0-9._-]{0,63}$/;

export function definePlatformPlugin(plugin: PlatformPlugin): PlatformPlugin {
  return {
    ...plugin,
    version: resolvedPluginVersion(plugin),
  };
}

export function applyPlatformPlugins(
  plugins: readonly PlatformPlugin[],
  ctx: PlatformPluginContext,
): string[] {
  const names: string[] = [];
  const seen = new Set<string>();

  for (const plugin of plugins) {
    const name = plugin.name?.trim() ?? '';
    if (!PLUGIN_NAME_PATTERN.test(name)) {
      throw new ValidationError('Invalid platform plugin name', [
        {
          path: 'plugin.name',
          message:
            'Plugin names must be lowercase dotted identifiers (letters, digits, ".", "_" or "-")',
          code: 'custom',
        },
      ]);
    }

    if (seen.has(name)) {
      throw new ValidationError('Duplicate platform plugin', [
        {
          path: 'plugin.name',
          message: `Plugin "${name}" is already registered`,
          code: 'custom',
        },
      ]);
    }

    seen.add(name);
    resolvedPluginVersion(plugin);
    if (plugin.capabilities?.length) {
      registerContributorCapabilities(ctx.capabilities, [plugin]);
    }
    plugin.register?.(ctx);
    names.push(name);
  }

  return names;
}

function resolvedPluginVersion(plugin: PlatformPlugin): string {
  const version = plugin.version?.trim() || PLUGIN_VERSION;
  if (!isValidPluginVersion(version)) {
    throw new ValidationError('Invalid platform plugin version', [
      {
        path: 'plugin.version',
        message: `Plugin "${plugin.name ?? 'unknown'}" version "${plugin.version}" must be major.minor.patch (optional -prerelease), without a leading v.`,
        code: 'custom',
      },
    ]);
  }
  return version;
}

export function bindPlatformPlugins(options: ApplyPlatformPluginsOptions): string[] {
  const ctx: PlatformPluginContext = {
    role: options.role,
    config: options.config,
    logger: options.logger,
    jobs: options.jobs,
    events: options.events,
    scheduler: options.scheduler ?? null,
    registries: options.registries,
    capabilities: options.capabilities,
  };

  return applyPlatformPlugins(options.plugins ?? [], ctx);
}
