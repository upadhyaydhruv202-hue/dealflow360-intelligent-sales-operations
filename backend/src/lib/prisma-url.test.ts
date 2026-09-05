import { describe, expect, it } from 'vitest';

import { withPoolParams } from './prisma-url';

describe('withPoolParams', () => {
  it('adds pool settings when they are absent', () => {
    const url = withPoolParams('postgresql://postgres:postgres@localhost:5432/hackathon', 10, 8);

    expect(url).toContain('connection_limit=10');
    expect(url).toContain('pool_timeout=8');
  });

  it('does not override pool settings already present in the URL', () => {
    const url = withPoolParams(
      'postgresql://postgres:postgres@localhost:5432/hackathon?connection_limit=3&pool_timeout=2',
      10,
      8,
    );

    expect(url).toContain('connection_limit=3');
    expect(url).toContain('pool_timeout=2');
  });
});
