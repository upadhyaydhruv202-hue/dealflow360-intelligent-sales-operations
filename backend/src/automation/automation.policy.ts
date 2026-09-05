import { AuthorizationError, ValidationError } from '../errors';
import { hasPermission } from '../rbac/authorize';
import { parseWithSchema } from '../schemas/parse';
import type { AuthenticatedUser } from '../auth/types';
import type { AutomationRegistries } from './automation.registry';
import { builtinOperatorSchema } from './automation.schemas';
import type { AutomationAction, AutomationCondition, AutomationRuleRecord } from './automation.types';

export interface RuleValidationInput {
  trigger: string;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  allowDestructive: boolean;
  source: 'manual' | 'ai';
}

export function validateAutomationRule(
  input: RuleValidationInput,
  registries: AutomationRegistries,
  actor?: AuthenticatedUser,
): void {
  if (!registries.triggers.has(input.trigger)) {
    throw new ValidationError('Unknown automation trigger', [
      { path: 'trigger', message: `Trigger "${input.trigger}" is not registered`, code: 'custom' },
    ]);
  }

  if (input.conditions.length === 0 && input.actions.length === 0) {
    throw new ValidationError('Automation rules require at least one action', [
      { path: 'actions', message: 'At least one action is required', code: 'custom' },
    ]);
  }

  input.conditions.forEach((condition, index) => {
    if (!registries.operators.has(condition.operator)) {
      throw new ValidationError('Unknown condition operator', [
        {
          path: `conditions.${index}.operator`,
          message: `Operator "${condition.operator}" is not registered`,
          code: 'custom',
        },
      ]);
    }

    if (registries.operators.list().includes(condition.operator)) {
      parseWithSchema(builtinOperatorSchema, condition.operator, {
        source: 'body',
        message: 'Invalid condition operator',
      });
    }

    if (condition.operator !== 'exists' && condition.value === undefined) {
      throw new ValidationError('Condition value is required', [
        { path: `conditions.${index}.value`, message: 'Value is required for this operator', code: 'custom' },
      ]);
    }

    if (condition.operator === 'in' && !Array.isArray(condition.value)) {
      throw new ValidationError('Condition value must be an array', [
        { path: `conditions.${index}.value`, message: 'The in operator requires an array value', code: 'custom' },
      ]);
    }
  });

  if (input.actions.length === 0) {
    throw new ValidationError('Automation rules require at least one action', [
      { path: 'actions', message: 'At least one action is required', code: 'custom' },
    ]);
  }

  let requiresDestructive = false;
  input.actions.forEach((action, index) => {
    const registered = registries.actions.get(action.type);
    if (!registered) {
      throw new ValidationError('Unknown automation action', [
        { path: `actions.${index}.type`, message: `Action "${action.type}" is not registered`, code: 'custom' },
      ]);
    }

    parseWithSchema(registered.inputSchema, action, {
      source: 'body',
      message: `Invalid configuration for action "${action.type}"`,
    });

    if (registered.destructive || isDestructiveActionConfig(action)) {
      requiresDestructive = true;
    }

    if (isOdooWriteAction(action) && action.confirmed !== true) {
      throw new ValidationError('Odoo writes require explicit confirmation on the action', [
        {
          path: `actions.${index}.confirmed`,
          message: 'Set confirmed to true on callOdoo create/write/unlink actions',
          code: 'custom',
        },
      ]);
    }

    if (actor && !hasPermission(actor, registered.requiredPermission)) {
      throw new AuthorizationError('You are not allowed to configure this automation action', {
        requiredPermissions: [registered.requiredPermission],
        action: action.type,
      });
    }
  });

  if (requiresDestructive && !input.allowDestructive) {
    throw new ValidationError('Destructive actions require explicit policy', [
      {
        path: 'allowDestructive',
        message: 'Set allowDestructive to true to include destructive actions such as updateRecord, webhook, or Odoo writes',
        code: 'custom',
      },
    ]);
  }
}

export function assertCanEnable(
  rule: Pick<AutomationRuleRecord, 'source' | 'validatedAt' | 'enabled'>,
): void {
  if (rule.source === 'ai' && !rule.validatedAt) {
    throw new ValidationError('AI-generated automation rules must be validated before activation', [
      { path: 'source', message: 'Call validate before enable for AI-generated rules', code: 'custom' },
    ]);
  }
}

const ODOO_WRITE_METHODS = new Set(['create', 'write', 'unlink']);

function isOdooWriteAction(action: AutomationAction): boolean {
  if (action.type !== 'callOdoo') {
    return false;
  }
  const method = typeof action.method === 'string' ? action.method : '';
  return ODOO_WRITE_METHODS.has(method);
}

function isDestructiveActionConfig(action: AutomationAction): boolean {
  return isOdooWriteAction(action);
}
