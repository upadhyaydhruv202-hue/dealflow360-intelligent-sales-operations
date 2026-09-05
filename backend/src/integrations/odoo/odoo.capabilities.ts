import { AuthorizationError, ValidationError } from '../../errors';
import { PERMISSIONS } from '../../rbac/catalog';
import { parseWithSchema } from '../../schemas/parse';
import {
  odooCapabilitySchema,
  type OdooCapabilityDefinition,
} from './odoo.schemas';

export type OdooCapability = OdooCapabilityDefinition;

export class OdooCapabilityRegistry {
  private readonly capabilities = new Map<string, OdooCapability>();

  constructor(initial: readonly OdooCapability[] = []) {
    for (const capability of initial) {
      this.register(capability);
    }
  }

  register(capability: OdooCapability): this {
    const parsed = parseWithSchema(odooCapabilitySchema, capability, {
      source: 'config',
      message: 'Invalid Odoo capability',
    });

    if (this.capabilities.has(parsed.name)) {
      throw new ValidationError('Duplicate Odoo capability', [
        { path: 'config.name', message: `Capability "${parsed.name}" is already registered`, code: 'custom' },
      ]);
    }

    this.capabilities.set(parsed.name, parsed);
    return this;
  }

  get(name: string): OdooCapability | undefined {
    return this.capabilities.get(name);
  }

  require(name: string): OdooCapability {
    const capability = this.capabilities.get(name);
    if (!capability) {
      throw new AuthorizationError('Odoo action is not allowed', {
        provider: 'odoo',
        capability: name,
      });
    }

    return capability;
  }

  assertMethodAllowed(capability: OdooCapability, method: string): void {
    if (!capability.methods.includes(method)) {
      throw new AuthorizationError('Odoo action is not allowed', {
        provider: 'odoo',
        capability: capability.name,
        method,
      });
    }
  }

  list(): OdooCapability[] {
    return [...this.capabilities.values()];
  }
}

export function odooReadCapability(name: string, model: string): OdooCapability {
  return {
    name,
    model,
    methods: ['search', 'search_read', 'read', 'search_count'],
    permission: PERMISSIONS.ODOO_READ,
    risk: 'low',
  };
}

export function odooWriteCapability(
  name: string,
  model: string,
  options?: { requiresConfirmation?: boolean; methods?: string[] },
): OdooCapability {
  return {
    name,
    model,
    methods: options?.methods ?? ['create', 'write', 'unlink'],
    permission: PERMISSIONS.ODOO_WRITE,
    risk: 'high',
    requiresConfirmation: options?.requiresConfirmation ?? true,
  };
}

export function createOdooCapabilityRegistry(
  capabilities: readonly OdooCapability[] = [],
): OdooCapabilityRegistry {
  return new OdooCapabilityRegistry(capabilities);
}
