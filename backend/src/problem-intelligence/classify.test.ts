import { describe, expect, it } from 'vitest';

import { createPlatformCapabilityRegistry } from '../capabilities';
import { classifyMappings, resolveCatalogCapability, toUnknownableList } from './classify';
import { UNKNOWN_VALUE } from './types';
import type { RequirementMappingDraft } from './types';

const registry = createPlatformCapabilityRegistry();

function mapping(overrides: Partial<RequirementMappingDraft>): RequirementMappingDraft {
  return {
    requirement: 'Users must log in',
    category: 'security',
    existingCapability: 'auth',
    newProblemLogic: UNKNOWN_VALUE,
    confidence: 0.9,
    ...overrides,
  };
}

describe('resolveCatalogCapability', () => {
  it('resolves exact catalog names and aliases', () => {
    expect(resolveCatalogCapability('auth', registry)).toMatchObject({
      capability: { name: 'auth' },
    });
    expect(resolveCatalogCapability('PostgreSQL', registry)).toMatchObject({
      capability: { name: 'infrastructure.postgres' },
    });
    expect(resolveCatalogCapability('document intelligence', registry)).toMatchObject({
      capability: { name: 'documents' },
    });
  });

  it('treats unknown as unknown instead of inventing a capability', () => {
    expect(resolveCatalogCapability('unknown', registry)).toEqual({ unknown: true });
    expect(resolveCatalogCapability('   ', registry)).toEqual({ unknown: true });
  });

  it('flags hallucinated capabilities instead of treating them as existing', () => {
    expect(resolveCatalogCapability('blockchain', registry)).toEqual({ hallucinated: 'blockchain' });
    expect(resolveCatalogCapability('kafka', registry)).toEqual({ hallucinated: 'kafka' });
  });
});

describe('classifyMappings', () => {
  it('classifies Requirement → Existing Capability → New Problem Logic', () => {
    const { mappings } = classifyMappings(
      [
        mapping({}),
        mapping({
          requirement: 'Store work items',
          category: 'entity',
          existingCapability: 'database',
          newProblemLogic: 'Add a work_items model under modules/problem.',
        }),
        mapping({
          requirement: 'Custom scoring rules',
          category: 'business_rule',
          existingCapability: UNKNOWN_VALUE,
          newProblemLogic: 'Implement scoring in the problem module.',
        }),
      ],
      registry,
    );

    expect(mappings[0]).toMatchObject({
      classification: 'existing_capability',
      existingCapability: { name: 'auth' },
      newProblemLogic: null,
      hallucinatedCapability: null,
    });
    expect(mappings[1]).toMatchObject({
      classification: 'both',
      existingCapability: { name: 'database' },
      newProblemLogic: 'Add a work_items model under modules/problem.',
    });
    expect(mappings[2]).toMatchObject({
      classification: 'new_problem_logic',
      existingCapability: null,
    });
  });

  it('does not treat hallucinated capabilities as existing platform capabilities', () => {
    const { mappings, uncertainty } = classifyMappings(
      [
        mapping({
          requirement: 'Distributed ledger',
          category: 'integration',
          existingCapability: 'blockchain',
          newProblemLogic: UNKNOWN_VALUE,
        }),
        mapping({
          requirement: 'Custom ledger UI',
          category: 'entity',
          existingCapability: 'blockchain',
          newProblemLogic: 'Build a ledger screen in modules/problem.',
        }),
      ],
      registry,
    );

    expect(mappings[0].classification).toBe('unknown');
    expect(mappings[0].existingCapability).toBeNull();
    expect(mappings[0].hallucinatedCapability).toBe('blockchain');
    expect(mappings[1].classification).toBe('new_problem_logic');
    expect(mappings[1].existingCapability).toBeNull();
    expect(uncertainty.some((note) => note.includes('blockchain'))).toBe(true);
  });
});

describe('toUnknownableList', () => {
  it('represents undetermined lists as unknown instead of inventing items', () => {
    expect(toUnknownableList(UNKNOWN_VALUE)).toEqual({ determined: false, items: [] });
    expect(toUnknownableList([{ name: 'Staff', description: 'Creates records.' }])).toEqual({
      determined: true,
      items: [{ name: 'Staff', description: 'Creates records.' }],
    });
  });
});
