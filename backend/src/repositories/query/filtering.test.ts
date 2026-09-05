import { describe, expect, it } from 'vitest';

import { ValidationError } from '../../errors';
import { parseFilters, toPrismaWhere, type FilterCatalog } from './filtering';

const catalog = {
  email: { operators: ['eq', 'contains'], type: 'string' },
  status: { operators: ['eq', 'in'], type: 'enum', enumValues: ['active', 'disabled'] },
  createdAt: { operators: ['gte', 'lte'], type: 'date' },
} as const satisfies FilterCatalog;

describe('parseFilters', () => {
  it('returns an empty list when no filters are provided', () => {
    expect(parseFilters(undefined, catalog)).toEqual([]);
    expect(toPrismaWhere([])).toEqual({});
  });

  it('maps allowed rules to Prisma where clauses', () => {
    const rules = parseFilters(
      [
        { field: 'email', operator: 'contains', value: 'demo' },
        { field: 'status', operator: 'eq', value: 'active' },
      ],
      catalog,
    );

    expect(toPrismaWhere(rules)).toEqual({
      AND: [
        { email: { contains: 'demo', mode: 'insensitive' } },
        { status: 'active' },
      ],
    });
  });

  it('rejects unknown fields, operators, and invalid values', () => {
    expect(() =>
      parseFilters([{ field: 'passwordHash', operator: 'eq', value: 'x' }], catalog),
    ).toThrow(ValidationError);

    expect(() =>
      parseFilters([{ field: 'email', operator: 'gte', value: 'x' }], catalog),
    ).toThrow(ValidationError);

    expect(() =>
      parseFilters([{ field: 'status', operator: 'eq', value: 'superadmin' }], catalog),
    ).toThrow(ValidationError);
  });
});
