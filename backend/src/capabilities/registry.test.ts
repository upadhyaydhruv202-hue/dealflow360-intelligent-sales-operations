import { describe, expect, it } from 'vitest';

import { ValidationError } from '../errors';
import { defineCapability } from './catalog/define';
import { createCapabilityRegistry } from './registry';
import { assertCapabilityVersion, isValidCapabilityVersion } from './version';
import type { CapabilityDefinition } from './types';

function sample(overrides: Partial<CapabilityDefinition> = {}): CapabilityDefinition {
  return defineCapability({
    name: 'test.capability',
    kind: 'application',
    category: 'core',
    maturity: 'stable',
    summary: 'Fixture capability used by registry tests.',
    documentation: ['docs/foundation.md'],
    ...overrides,
  });
}

describe('CapabilityRegistry registration', () => {
  it('registers a valid capability', () => {
    const registry = createCapabilityRegistry();
    registry.register(sample());
    expect(registry.has('test.capability')).toBe(true);
    expect(registry.require('test.capability').maturity).toBe('stable');
    expect(registry.list()).toHaveLength(1);
  });

  it('rejects duplicate names', () => {
    const registry = createCapabilityRegistry([sample()]);
    expect(() => registry.register(sample())).toThrow(ValidationError);
    expect(() => registry.register(sample())).toThrow(/Duplicate capability/);
  });

  it('rejects invalid metadata', () => {
    const registry = createCapabilityRegistry();
    expect(() => registry.register(sample({ summary: '   ' }))).toThrow(ValidationError);
    expect(() =>
      registry.register(
        sample({
          name: 'Also Invalid',
        }),
      ),
    ).toThrow(ValidationError);
    expect(() =>
      registry.register({
        ...sample(),
        maturity: 'gold' as CapabilityDefinition['maturity'],
      }),
    ).toThrow(ValidationError);
    expect(() =>
      registry.register({
        ...sample(),
        kind: 'service' as CapabilityDefinition['kind'],
      }),
    ).toThrow(ValidationError);
  });
});

describe('capability version validation', () => {
  it('accepts strict semver', () => {
    expect(isValidCapabilityVersion('0.1.0')).toBe(true);
    expect(isValidCapabilityVersion('1.2.3-beta.1')).toBe(true);
    expect(assertCapabilityVersion('2.0.0')).toBe('2.0.0');
  });

  it('rejects invalid versions on register', () => {
    const registry = createCapabilityRegistry();
    expect(() => registry.register(sample({ version: 'v1.0.0' }))).toThrow(ValidationError);
    expect(() => registry.register(sample({ version: '1.0' }))).toThrow(ValidationError);
    expect(() => registry.register(sample({ version: 'latest' }))).toThrow(ValidationError);
    expect(isValidCapabilityVersion('')).toBe(false);
    expect(() => assertCapabilityVersion('1')).toThrow(/Invalid capability version/);
  });
});
