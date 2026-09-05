import { ValidationError } from '../errors';
import type { AutomationCondition, ConditionEvaluator } from './automation.types';
import { automationFieldPathSchema } from './automation.schemas';

const FORBIDDEN_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);

export class ConditionOperatorRegistry {
  private readonly operators = new Map<string, ConditionEvaluator>();

  register(name: string, evaluator: ConditionEvaluator): this {
    if (!/^[a-z][a-zA-Z0-9]*$/.test(name)) {
      throw new ValidationError('Invalid condition operator name', [
        { path: 'config.operator', message: `Operator "${name}" is not allowed`, code: 'custom' },
      ]);
    }

    if (this.operators.has(name)) {
      throw new ValidationError('Duplicate condition operator', [
        { path: 'config.operator', message: `Operator "${name}" is already registered`, code: 'custom' },
      ]);
    }

    this.operators.set(name, evaluator);
    return this;
  }

  get(name: string): ConditionEvaluator | undefined {
    return this.operators.get(name);
  }

  has(name: string): boolean {
    return this.operators.has(name);
  }

  list(): string[] {
    return [...this.operators.keys()];
  }
}

export function createBuiltinConditionRegistry(): ConditionOperatorRegistry {
  const registry = new ConditionOperatorRegistry();
  registry.register('equals', (field, value) => compareEqual(field, value));
  registry.register('notEquals', (field, value) => !compareEqual(field, value));
  registry.register('greaterThan', (field, value) => compareOrdered(field, value) > 0);
  registry.register('lessThan', (field, value) => compareOrdered(field, value) < 0);
  registry.register('greaterOrEqual', (field, value) => compareOrdered(field, value) >= 0);
  registry.register('lessOrEqual', (field, value) => compareOrdered(field, value) <= 0);
  registry.register('contains', (field, value) => containsValue(field, value));
  registry.register('in', (field, value) => {
    if (!Array.isArray(value)) {
      return false;
    }
    return value.some((item) => compareEqual(field, item));
  });
  registry.register('exists', (field) => field !== undefined && field !== null);
  return registry;
}

export function matchesConditions(
  conditions: readonly AutomationCondition[],
  payload: Record<string, unknown>,
  operators: ConditionOperatorRegistry,
): boolean {
  for (const condition of conditions) {
    const evaluator = operators.get(condition.operator);
    if (!evaluator) {
      throw new ValidationError('Unknown condition operator', [
        { path: 'conditions.operator', message: `Operator "${condition.operator}" is not registered`, code: 'custom' },
      ]);
    }

    const fieldValue = readPayloadPath(payload, condition.field);
    if (!evaluator(fieldValue, condition.value)) {
      return false;
    }
  }

  return true;
}

export function readPayloadPath(payload: Record<string, unknown>, path: string): unknown {
  const parsed = automationFieldPathSchema.safeParse(path);
  if (!parsed.success) {
    return undefined;
  }

  const segments = parsed.data.split('.');
  let current: unknown = payload;
  for (const segment of segments) {
    if (FORBIDDEN_SEGMENTS.has(segment)) {
      return undefined;
    }
    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

export function interpolateTemplate(template: string, payload: Record<string, unknown>): string {
  return template.replace(/\{\{\s*([A-Za-z][A-Za-z0-9_.]*)\s*\}\}/g, (_match, path: string) => {
    const value = readPayloadPath(payload, path);
    if (value === undefined || value === null) {
      return '';
    }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    return '';
  });
}

function compareEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) {
    return true;
  }
  if (typeof left === 'number' && typeof right === 'string' && right.trim() !== '') {
    return left === Number(right);
  }
  if (typeof right === 'number' && typeof left === 'string' && left.trim() !== '') {
    return Number(left) === right;
  }
  return false;
}

function compareOrdered(left: unknown, right: unknown): number {
  const leftNumber = toNumber(left);
  const rightNumber = toNumber(right);
  if (leftNumber === undefined || rightNumber === undefined) {
    return Number.NaN;
  }
  if (leftNumber === rightNumber) {
    return 0;
  }
  return leftNumber > rightNumber ? 1 : -1;
}

function containsValue(field: unknown, value: unknown): boolean {
  if (typeof field === 'string') {
    return typeof value === 'string' && field.includes(value);
  }
  if (Array.isArray(field)) {
    return field.some((item) => compareEqual(item, value));
  }
  return false;
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.getTime();
  }
  return undefined;
}
