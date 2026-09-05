import { ValidationError } from '../errors';
import { parseWithSchema } from '../schemas/parse';
import { isCapabilityEnabled } from './evaluate';
import { buildCapabilityGraph } from './graph';
import { resolveCapabilities, type CapabilityResolveRequest, type CapabilityResolution } from './resolve';
import { capabilityDefinitionSchema } from './schema';
import type {
  CapabilityDefinition,
  CapabilityEnablementConfig,
  CapabilityQuery,
  DiscoveredCapability,
} from './types';

export class CapabilityRegistry {
  private readonly capabilities = new Map<string, CapabilityDefinition>();

  constructor(initial: readonly CapabilityDefinition[] = []) {
    for (const capability of initial) {
      this.register(capability);
    }
  }

  register(capability: CapabilityDefinition): this {
    const parsed = parseWithSchema(capabilityDefinitionSchema, capability, {
      source: 'config',
      message: 'Invalid capability metadata',
    });

    if (this.capabilities.has(parsed.name)) {
      throw new ValidationError('Duplicate capability', [
        {
          path: 'config.name',
          message: `Capability "${parsed.name}" is already registered`,
          code: 'custom',
        },
      ]);
    }

    this.capabilities.set(parsed.name, parsed);
    return this;
  }

  get(name: string): CapabilityDefinition | undefined {
    return this.capabilities.get(name);
  }

  require(name: string): CapabilityDefinition {
    const capability = this.capabilities.get(name);
    if (!capability) {
      throw new ValidationError('Unknown capability', [
        { path: 'config.name', message: `Capability "${name}" is not registered`, code: 'custom' },
      ]);
    }
    return capability;
  }

  has(name: string): boolean {
    return this.capabilities.has(name);
  }

  list(): CapabilityDefinition[] {
    return [...this.capabilities.values()];
  }

  names(): string[] {
    return this.list().map((capability) => capability.name);
  }

  discover(
    config?: CapabilityEnablementConfig,
    query: CapabilityQuery & { includeDisabled?: boolean } = {},
  ): DiscoveredCapability[] {
    const includeDisabled = query.includeDisabled ?? true;
    return this.list()
      .map((capability) => ({
        ...capability,
        enabled: isCapabilityEnabled(capability, config),
      }))
      .filter((capability) => {
        if (!includeDisabled && !capability.enabled) {
          return false;
        }
        if (query.kind && capability.kind !== query.kind) {
          return false;
        }
        if (query.category && capability.category !== query.category) {
          return false;
        }
        if (query.maturity && capability.maturity !== query.maturity) {
          return false;
        }
        if (query.enabled !== undefined && capability.enabled !== query.enabled) {
          return false;
        }
        if (query.name && capability.name !== query.name) {
          return false;
        }
        return true;
      });
  }

  graph(): ReturnType<typeof buildCapabilityGraph> {
    return buildCapabilityGraph(this.list());
  }

  /**
   * Validate an explicit selection. Does not enable capabilities or construct services.
   */
  resolve(request: CapabilityResolveRequest): CapabilityResolution {
    return resolveCapabilities({
      ...request,
      capabilities: this.list(),
    });
  }

  toJSON(): CapabilityDefinition[] {
    return this.list();
  }
}

export function createCapabilityRegistry(
  capabilities: readonly CapabilityDefinition[] = [],
): CapabilityRegistry {
  return new CapabilityRegistry(capabilities);
}
