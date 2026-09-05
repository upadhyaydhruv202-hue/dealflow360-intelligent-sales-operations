import { describe, expect, it } from 'vitest';

import { PAGINATION, paginationMetaSchema } from './pagination';

describe('pagination meta', () => {
  it('accepts the documented list meta shape including an empty page', () => {
    expect(PAGINATION.MAX_PAGE_SIZE).toBe(100);
    expect(
      paginationMetaSchema.parse({
        page: 1,
        pageSize: 20,
        totalItems: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      }),
    ).toMatchObject({ page: 1, totalPages: 0 });
  });

  it('rejects a page size above the shared maximum', () => {
    expect(
      paginationMetaSchema.safeParse({
        page: 1,
        pageSize: PAGINATION.MAX_PAGE_SIZE + 1,
        totalItems: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      }).success,
    ).toBe(false);
  });
});
