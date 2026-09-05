import { describe, expect, it } from 'vitest';

import { ValidationError } from '../../errors';
import { parseSort, toPrismaOrderBy } from './sorting';

const ALLOWED = ['createdAt', 'email'] as const;

describe('parseSort', () => {
  it('falls back to the default field and order', () => {
    expect(parseSort({}, ALLOWED, 'createdAt')).toEqual({ field: 'createdAt', order: 'desc' });
  });

  it('accepts a whitelisted field', () => {
    expect(parseSort({ sortBy: 'email', sortOrder: 'ASC' }, ALLOWED, 'createdAt')).toEqual({
      field: 'email',
      order: 'asc',
    });
  });

  it('rejects unknown fields and orders', () => {
    expect(() => parseSort({ sortBy: 'passwordHash' }, ALLOWED, 'createdAt')).toThrow(ValidationError);
    expect(() => parseSort({ sortOrder: 'sideways' }, ALLOWED, 'createdAt')).toThrow(ValidationError);
  });

  it('maps to a Prisma orderBy object', () => {
    expect(toPrismaOrderBy({ field: 'email', order: 'asc' })).toEqual({ email: 'asc' });
  });
});
