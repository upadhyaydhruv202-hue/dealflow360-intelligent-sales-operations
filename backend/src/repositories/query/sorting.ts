import { ValidationError } from '../../errors';
import { sortQuerySchema } from '../../schemas/common';
import { issuesFromZodError } from '../../schemas/parse';

export type SortOrder = 'asc' | 'desc';

export interface SortInput {
  sortBy?: string;
  sortOrder?: string;
}

export interface ParsedSort<T extends string> {
  field: T;
  order: SortOrder;
}

export function parseSort<T extends string>(
  input: SortInput,
  allowed: readonly T[],
  defaultField: T,
  defaultOrder: SortOrder = 'desc',
): ParsedSort<T> {
  const parsed = sortQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError('Invalid sort query', issuesFromZodError(parsed.error, 'query'));
  }

  const field = (parsed.data.sortBy ?? defaultField) as T;
  const order = parsed.data.sortOrder ?? defaultOrder;

  if (!allowed.includes(field)) {
    throw new ValidationError('Invalid sort field', {
      sortBy: input.sortBy,
      allowed: [...allowed],
    });
  }

  return { field, order };
}

export function toPrismaOrderBy<T extends string>(sort: ParsedSort<T>): Record<T, SortOrder> {
  return { [sort.field]: sort.order } as Record<T, SortOrder>;
}
