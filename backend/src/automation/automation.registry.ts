import { z, type ZodTypeAny } from 'zod';

import { ValidationError } from '../errors';
import { parseWithSchema } from '../schemas/parse';
import { automationActionTypeSchema, automationTriggerNameSchema } from './automation.schemas';
import type {
  AutomationActionDescriptor,
  AutomationTriggerDefinition,
  ConditionEvaluator,
  RecordUpdater,
  RegisteredAutomationAction,
} from './automation.types';
import { ConditionOperatorRegistry, createBuiltinConditionRegistry } from './automation.conditions';

const FORBIDDEN_ACTION_TYPE =
  /^(eval|exec|executeSql|sql|queryRaw|rawQuery|shell|bash|powershell|spawn|javascript|js)$/i;

export class AutomationTriggerRegistry {
  private readonly triggers = new Map<string, AutomationTriggerDefinition>();

  register(trigger: AutomationTriggerDefinition): this {
    const name = parseWithSchema(automationTriggerNameSchema, trigger.name, {
      source: 'config',
      message: 'Invalid automation trigger name',
    });
    if (!trigger.description?.trim()) {
      throw new ValidationError('Automation triggers require a description', [
        { path: 'config.description', message: 'Description is required', code: 'custom' },
      ]);
    }
    if (this.triggers.has(name)) {
      throw new ValidationError('Duplicate automation trigger', [
        { path: 'config.name', message: `Trigger "${name}" is already registered`, code: 'custom' },
      ]);
    }
    this.triggers.set(name, { ...trigger, name });
    return this;
  }

  get(name: string): AutomationTriggerDefinition | undefined {
    return this.triggers.get(name);
  }

  has(name: string): boolean {
    return this.triggers.has(name);
  }

  list(): AutomationTriggerDefinition[] {
    return [...this.triggers.values()];
  }
}

export class AutomationActionRegistry {
  private readonly actions = new Map<string, RegisteredAutomationAction>();

  register(action: RegisteredAutomationAction): this {
    const type = parseWithSchema(automationActionTypeSchema, action.type, {
      source: 'config',
      message: 'Invalid automation action type',
    });
    if (FORBIDDEN_ACTION_TYPE.test(type)) {
      throw new ValidationError('Automation actions cannot expose arbitrary execution', [
        { path: 'config.type', message: `Action "${type}" is not allowed`, code: 'custom' },
      ]);
    }
    if (!action.description?.trim()) {
      throw new ValidationError('Automation actions require a description', [
        { path: 'config.description', message: 'Description is required', code: 'custom' },
      ]);
    }
    if (this.actions.has(type)) {
      throw new ValidationError('Duplicate automation action', [
        { path: 'config.type', message: `Action "${type}" is already registered`, code: 'custom' },
      ]);
    }
    this.actions.set(type, { ...action, type });
    return this;
  }

  get(type: string): RegisteredAutomationAction | undefined {
    return this.actions.get(type);
  }

  has(type: string): boolean {
    return this.actions.has(type);
  }

  list(): RegisteredAutomationAction[] {
    return [...this.actions.values()];
  }

  descriptors(): AutomationActionDescriptor[] {
    return this.list().map((action) => ({
      type: action.type,
      description: action.description,
      requiredPermission: action.requiredPermission,
      destructive: action.destructive,
      arguments: describeSchema(action.inputSchema),
    }));
  }
}

export class RecordUpdaterRegistry {
  private readonly updaters = new Map<string, RecordUpdater>();

  register(updater: RecordUpdater): this {
    const resource = updater.resource.trim();
    if (!/^[a-z][a-z0-9._-]*$/.test(resource)) {
      throw new ValidationError('Invalid updateRecord resource', [
        { path: 'config.resource', message: `Resource "${resource}" is not allowed`, code: 'custom' },
      ]);
    }
    if (this.updaters.has(resource)) {
      throw new ValidationError('Duplicate record updater', [
        { path: 'config.resource', message: `Resource "${resource}" is already registered`, code: 'custom' },
      ]);
    }
    this.updaters.set(resource, updater);
    return this;
  }

  get(resource: string): RecordUpdater | undefined {
    return this.updaters.get(resource);
  }

  has(resource: string): boolean {
    return this.updaters.has(resource);
  }

  list(): string[] {
    return [...this.updaters.keys()];
  }
}

export class AllowedJobRegistry {
  private readonly names = new Set<string>();

  allow(name: string): this {
    const trimmed = name.trim();
    if (!/^[a-z][a-z0-9._-]*$/.test(trimmed)) {
      throw new ValidationError('Invalid job name', [
        { path: 'config.jobName', message: `Job "${trimmed}" is not allowed`, code: 'custom' },
      ]);
    }
    if (trimmed === 'automation.execute') {
      throw new ValidationError('Automation cannot enqueue its own execute job', [
        { path: 'config.jobName', message: 'Recursive automation.execute is not allowed', code: 'custom' },
      ]);
    }
    this.names.add(trimmed);
    return this;
  }

  has(name: string): boolean {
    return this.names.has(name);
  }

  list(): string[] {
    return [...this.names];
  }
}

export interface AutomationRegistries {
  triggers: AutomationTriggerRegistry;
  actions: AutomationActionRegistry;
  operators: ConditionOperatorRegistry;
  recordUpdaters: RecordUpdaterRegistry;
  allowedJobs: AllowedJobRegistry;
}

export function createAutomationRegistries(options?: {
  operators?: ConditionOperatorRegistry;
}): AutomationRegistries {
  return {
    triggers: new AutomationTriggerRegistry(),
    actions: new AutomationActionRegistry(),
    operators: options?.operators ?? createBuiltinConditionRegistry(),
    recordUpdaters: new RecordUpdaterRegistry(),
    allowedJobs: new AllowedJobRegistry(),
  };
}

export function describeSchema(schema: ZodTypeAny): Record<string, string> {
  const objectSchema = unwrapObject(schema);
  if (!objectSchema) {
    return { value: describeType(schema) };
  }

  return Object.fromEntries(
    Object.entries(objectSchema.shape).map(([key, value]) => [key, describeType(value as ZodTypeAny)]),
  );
}

function unwrapObject(schema: ZodTypeAny): z.ZodObject<z.ZodRawShape> | null {
  let current: ZodTypeAny = schema;
  for (let i = 0; i < 6; i += 1) {
    if (current instanceof z.ZodObject) {
      return current;
    }

    const def = current._def as { typeName?: string; innerType?: ZodTypeAny; schema?: ZodTypeAny };
    if (def.innerType) {
      current = def.innerType;
      continue;
    }
    if (def.schema) {
      current = def.schema;
      continue;
    }
    return null;
  }
  return null;
}

function describeType(schema: ZodTypeAny): string {
  const def = schema._def as {
    typeName?: string;
    innerType?: ZodTypeAny;
    type?: ZodTypeAny;
    values?: string[];
  };

  switch (def.typeName) {
    case 'ZodOptional':
    case 'ZodDefault':
      return `${describeType(def.innerType as ZodTypeAny)}?`;
    case 'ZodNullable':
      return `${describeType(def.innerType as ZodTypeAny)}|null`;
    case 'ZodArray':
      return `${describeType(def.type as ZodTypeAny)}[]`;
    case 'ZodEnum':
      return (def.values ?? []).join('|');
    case 'ZodString':
      return 'string';
    case 'ZodNumber':
      return 'number';
    case 'ZodBoolean':
      return 'boolean';
    case 'ZodObject':
      return 'object';
    default:
      return 'value';
  }
}

export type { ConditionEvaluator };
