import { PLATFORM_CAPABILITIES } from './catalog';
import { createCapabilityRegistry, type CapabilityRegistry } from './registry';
import type {
  CapabilityContributor,
  CapabilityDefinition,
  CapabilityEnablementConfig,
  DiscoverCapabilitiesOptions,
  DiscoveredCapability,
} from './types';

export function createPlatformCapabilityRegistry(): CapabilityRegistry {
  return createCapabilityRegistry(PLATFORM_CAPABILITIES);
}

export function registerContributorCapabilities(
  registry: CapabilityRegistry,
  contributors: readonly CapabilityContributor[],
): void {
  for (const contributor of contributors) {
    for (const capability of contributor.capabilities ?? []) {
      registry.register(capability);
    }
  }
}

/**
 * Discover catalog + plugin metadata without constructing AI, Odoo, email, or other services.
 * Does not resolve dependency graphs. Use `resolveCapabilities` for validation and ordering.
 */
export function discoverCapabilities(
  options: DiscoverCapabilitiesOptions = {},
): DiscoveredCapability[] {
  const registry = createPlatformCapabilityRegistry();
  registerContributorCapabilities(registry, options.plugins ?? []);
  for (const extra of options.extras ?? []) {
    registry.register(extra);
  }

  return registry.discover(options.config, {
    includeDisabled: options.includeDisabled ?? true,
  });
}

export function snapshotCapabilities(
  registry: CapabilityRegistry,
  config?: CapabilityEnablementConfig,
): DiscoveredCapability[] {
  return registry.discover(config);
}

export function capabilityNames(capabilities: readonly CapabilityDefinition[]): string[] {
  return capabilities.map((capability) => capability.name);
}
