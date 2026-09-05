import { describe, expect, it } from 'vitest';

import { cn } from './cn';
import { joinApiPath } from '../services/api';

describe('cn', () => {
  it('joins truthy class names and ignores empty values', () => {
    expect(cn('a', false, undefined, ['b', null, 'c'])).toBe('a b c');
  });
});

describe('joinApiPath', () => {
  it('omits empty query values and appends a query string', () => {
    expect(joinApiPath('/api/v1/items', { q: 'alpha', empty: '', skip: undefined, page: 2 })).toBe(
      '/api/v1/items?q=alpha&page=2',
    );
  });
});
