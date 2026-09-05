import { describe, expect, it } from 'vitest';

import { ValidationError } from '../../errors';
import { defineProfile } from './define';
import { createProfileRegistry } from './registry';
import type { ProjectProfile } from './types';

function sample(overrides: Partial<ProjectProfile> = {}): ProjectProfile {
  return defineProfile({
    name: 'profile.test',
    title: 'Test',
    maturity: 'stable',
    summary: 'Fixture profile used by registry tests.',
    documentation: ['docs/profiles.md'],
    ...overrides,
  });
}

describe('ProfileRegistry', () => {
  it('registers a valid profile', () => {
    const registry = createProfileRegistry();
    registry.register(sample());
    expect(registry.has('profile.test')).toBe(true);
    expect(registry.require('profile.test').title).toBe('Test');
    expect(registry.list()).toHaveLength(1);
  });

  it('rejects duplicate names and invalid metadata', () => {
    const registry = createProfileRegistry([sample()]);
    expect(() => registry.register(sample())).toThrow(ValidationError);
    expect(() => createProfileRegistry().register(sample({ name: 'Not Valid' }))).toThrow(
      ValidationError,
    );
    expect(() =>
      createProfileRegistry().register({
        ...sample(),
        maturity: 'gold' as ProjectProfile['maturity'],
      }),
    ).toThrow(ValidationError);
  });

  it('rejects an unsupported combination with no dimensions', () => {
    expect(() =>
      createProfileRegistry().register(
        sample({
          incompatibleWith: [{ message: 'nothing named' }],
        }),
      ),
    ).toThrow(ValidationError);
  });
});
