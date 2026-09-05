import { ValidationError } from '../errors';
import { confirmationRequired, describeSchema, FORBIDDEN_AI_TOOL_NAME } from '../integrations/ai/guardrails';
import { parseWithSchema } from '../schemas/parse';
import { intentNameSchema } from './intents.schemas';
import {
  INTENT_HIGH_RISK_ACTION_KIND,
  type IntentDescriptor,
  type RegisteredIntent,
} from './intents.types';

export { describeSchema };

export const FORBIDDEN_INTENT_NAME =
  /^(eval|exec|execute[_]?sql|execute[_]?odoo|sql|query[_]?raw|raw[_]?query|shell|bash|sh|cmd|powershell|spawn|fork|http|fetch|curl|request|subprocess)($|_)/i;

export class IntentRegistry {
  private readonly intents = new Map<string, RegisteredIntent>();

  register(intent: RegisteredIntent): this {
    const name = parseWithSchema(intentNameSchema, intent.name, {
      source: 'config',
      message: 'Invalid intent name',
    });

    if (FORBIDDEN_INTENT_NAME.test(name) || FORBIDDEN_AI_TOOL_NAME.test(toCamelProbe(name))) {
      throw new ValidationError('Intents cannot expose arbitrary execution', [
        { path: 'config.name', message: `Intent "${name}" is not allowed`, code: 'custom' },
      ]);
    }

    if (!intent.description?.trim()) {
      throw new ValidationError('Intents require a description', [
        { path: 'config.description', message: 'Description is required', code: 'custom' },
      ]);
    }

    if (!intent.requiredPermission?.trim()) {
      throw new ValidationError('Intents require a permission', [
        { path: 'config.requiredPermission', message: 'Permission is required', code: 'custom' },
      ]);
    }

    if (!intent.inputSchema) {
      throw new ValidationError('Intents require an input schema', [
        { path: 'config.inputSchema', message: 'Schema is required', code: 'custom' },
      ]);
    }

    if (!intent.handler) {
      throw new ValidationError('Intents require a handler', [
        { path: 'config.handler', message: 'Handler is required', code: 'custom' },
      ]);
    }

    if (this.intents.has(name)) {
      throw new ValidationError('Duplicate intent', [
        { path: 'config.name', message: `Intent "${name}" is already registered`, code: 'custom' },
      ]);
    }

    this.intents.set(name, { ...intent, name });
    return this;
  }

  get(name: string): RegisteredIntent | undefined {
    return this.intents.get(name);
  }

  has(name: string): boolean {
    return this.intents.has(name);
  }

  list(): RegisteredIntent[] {
    return [...this.intents.values()];
  }

  names(): string[] {
    return this.list().map((intent) => intent.name);
  }

  descriptors(): IntentDescriptor[] {
    return this.list().map((intent) => {
      const actionKind = resolveActionKind(intent);
      return {
        name: intent.name,
        description: intent.description,
        arguments: describeSchema(intent.inputSchema),
        requiredPermission: intent.requiredPermission,
        riskLevel: intent.riskLevel,
        actionKind,
        highRiskClass: intent.highRiskClass,
        requiresConfirmation: intentRequiresConfirmation(intent),
        examples: intent.examples ?? [],
      };
    });
  }
}

export function createIntentRegistry(intents: readonly RegisteredIntent[] = []): IntentRegistry {
  const registry = new IntentRegistry();
  for (const intent of intents) {
    registry.register(intent);
  }
  return registry;
}

export function resolveActionKind(intent: Pick<RegisteredIntent, 'actionKind' | 'highRiskClass'>) {
  if (intent.highRiskClass) {
    return INTENT_HIGH_RISK_ACTION_KIND[intent.highRiskClass];
  }
  return intent.actionKind;
}

export function intentRequiresConfirmation(intent: RegisteredIntent, input?: unknown): boolean {
  const parsedNeeds = input !== undefined && intent.needsConfirmation?.(input) === true;
  return confirmationRequired({
    riskLevel: intent.riskLevel,
    actionKind: resolveActionKind(intent),
    needsConfirmation: parsedNeeds || Boolean(intent.highRiskClass),
  });
}

function toCamelProbe(name: string): string {
  const parts = name.toLowerCase().split('_').filter(Boolean);
  if (parts.length === 0) {
    return name;
  }
  return parts[0] + parts.slice(1).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join('');
}
