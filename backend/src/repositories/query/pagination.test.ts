import { describe, expect, it } from 'vitest';

import { ValidationError } from '../../errors';
import { MAX_PAGE_SIZE, parsePagination } from './pagination';

describe('parsePagination', () => {
  it('uses safe defaults', () => {
    expect(parsePagination()).toEqual({
      page: 1,
      pageSize: 20,
      skip: 0,
      take: 20,
    });
  });

  it('accepts string query values', () => {
    expect(parsePagination({ page: '3', pageSize: '10' })).toMatchObject({
      page: 3,
      pageSize: 10,
      skip: 20,
      take: 10,
    });
  });

  it('rejects non-positive or non-integer pages', () => {
    expect(() => parsePagination({ page: 0 })).toThrow(ValidationError);
    expect(() => parsePagination({ page: 1.5 })).toThrow(ValidationError);
    expect(() => parsePagination({ page: 'abc' })).toThrow(ValidationError);
  });

  it('enforces a maximum page size', () => {
    expect(() => parsePagination({ pageSize: MAX_PAGE_SIZE + 1 })).toThrow(ValidationError);
    expect(parsePagination({ pageSize: MAX_PAGE_SIZE }).pageSize).toBe(MAX_PAGE_SIZE);
  });
});
