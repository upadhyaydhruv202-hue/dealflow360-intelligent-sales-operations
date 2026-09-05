import { FILTER_OPERATORS, type FilterOperator } from '../../constants';
import { ValidationError } from '../../errors';
import { filterRulesSchema, idSchema } from '../../schemas/common';
import { issuesFromZodError } from '../../schemas/parse';

export { FILTER_OPERATORS };
export type { FilterOperator };

export interface FilterRule {
  field: string;
  operator: FilterOperator;
  value: unknown;
}

export interface FilterFieldConfig {
  operators: readonly FilterOperator[];
  type: 'string' | 'uuid' | 'enum' | 'date' | 'boolean';
  enumValues?: readonly string[];
}

export type FilterCatalog = Record<string, FilterFieldConfig>;

const MAX_IN_VALUES = 50;
const MAX_CONTAINS_LENGTH = 200;

export function parseFilters(input: unknown, catalog: FilterCatalog): FilterRule[] {
  if (input === undefined || input === null) {
    return [];
  }

  const parsed = filterRulesSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError('Invalid filter payload', issuesFromZodError(parsed.error, 'query'));
  }

  return parsed.data.map((rule) => {
    if (rule.value === undefined) {
      throw new ValidationError('Filter value is required', { field: rule.field });
    }

    return normalizeRule(
      {
        field: rule.field,
        operator: rule.operator,
        value: rule.value,
      },
      catalog,
    );
  });
}

export function toPrismaWhere(rules: FilterRule[]): Record<string, unknown> {
  if (rules.length === 0) {
    return {};
  }

  const clauses = rules.map(ruleToPrisma);
  return clauses.length === 1 ? clauses[0] : { AND: clauses };
}

function normalizeRule(rule: FilterRule, catalog: FilterCatalog): FilterRule {
  const field = catalog[rule.field];
  if (!field) {
    throw new ValidationError('Unknown filter field', {
      field: rule.field,
      allowed: Object.keys(catalog),
    });
  }

  if (!field.operators.includes(rule.operator)) {
    throw new ValidationError('Filter operator is not allowed for this field', {
      field: rule.field,
      operator: rule.operator,
      allowed: field.operators,
    });
  }

  return {
    field: rule.field,
    operator: rule.operator,
    value: coerceValue(rule, field),
  };
}

function coerceValue(rule: FilterRule, field: FilterFieldConfig): unknown {
  if (rule.operator === 'in') {
    if (!Array.isArray(rule.value) || rule.value.length === 0 || rule.value.length > MAX_IN_VALUES) {
      throw new ValidationError('Filter "in" values must be a non-empty array', {
        field: rule.field,
        maxItems: MAX_IN_VALUES,
      });
    }

    return rule.value.map((item) => coerceScalar(item, field, rule.field));
  }

  if (rule.operator === 'contains') {
    if (typeof rule.value !== 'string' || rule.value.length === 0 || rule.value.length > MAX_CONTAINS_LENGTH) {
      throw new ValidationError('Filter "contains" value must be a non-empty string', {
        field: rule.field,
        maxLength: MAX_CONTAINS_LENGTH,
      });
    }

    return rule.value;
  }

  return coerceScalar(rule.value, field, rule.field);
}

function coerceScalar(value: unknown, field: FilterFieldConfig, fieldName: string): unknown {
  switch (field.type) {
    case 'string':
      if (typeof value !== 'string' || value.length === 0) {
        throw new ValidationError('Filter value must be a non-empty string', { field: fieldName });
      }
      return value;
    case 'uuid': {
      const parsedId = idSchema.safeParse(value);
      if (!parsedId.success) {
        throw new ValidationError('Filter value must be a UUID', { field: fieldName });
      }
      return parsedId.data.toLowerCase();
    }
    case 'enum':
      if (typeof value !== 'string' || !field.enumValues?.includes(value)) {
        throw new ValidationError('Filter value is not an allowed enum value', {
          field: fieldName,
          allowed: field.enumValues,
        });
      }
      return value;
    case 'boolean':
      if (typeof value === 'boolean') {
        return value;
      }
      if (value === 'true' || value === 'false') {
        return value === 'true';
      }
      throw new ValidationError('Filter value must be a boolean', { field: fieldName });
    case 'date': {
      const date = value instanceof Date ? value : new Date(String(value));
      if (Number.isNaN(date.getTime())) {
        throw new ValidationError('Filter value must be a valid date', { field: fieldName });
      }
      return date;
    }
    default:
      throw new ValidationError('Unsupported filter type', { field: fieldName });
  }
}

function ruleToPrisma(rule: FilterRule): Record<string, unknown> {
  switch (rule.operator) {
    case 'eq':
      return { [rule.field]: rule.value };
    case 'neq':
      return { [rule.field]: { not: rule.value } };
    case 'contains':
      return { [rule.field]: { contains: rule.value, mode: 'insensitive' } };
    case 'in':
      return { [rule.field]: { in: rule.value } };
    case 'gte':
      return { [rule.field]: { gte: rule.value } };
    case 'lte':
      return { [rule.field]: { lte: rule.value } };
    default:
      throw new ValidationError('Unsupported filter operator', { operator: rule.operator });
  }
}
