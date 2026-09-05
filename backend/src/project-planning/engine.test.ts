import { describe, expect, it } from 'vitest';

import { PROFILE_NAMES } from '../capabilities';
import { ValidationError } from '../errors';
import { analysisSimpleSearch } from '../capability-recommendations';
import {
  assertApprovedConfiguration,
  buildProjectConfiguration,
  configurationIntegrity,
} from './engine';
import { PROJECT_CONFIGURATION_SCHEMA_VERSION } from './types';

const AUTH_STACK = ['auth', 'database', 'infrastructure.postgres'] as const;

describe('buildProjectConfiguration', () => {
  it('validates an explicit closed auth stack without generating code', () => {
    const result = buildProjectConfiguration(
      { capabilities: [...AUTH_STACK], title: 'Auth' },
      { intent: 'validate', id: () => 'cfg-1' },
    );

    expect(result.schemaVersion).toBe(PROJECT_CONFIGURATION_SCHEMA_VERSION);
    expect(result.id).toBe('cfg-1');
    expect(result.status).toBe('draft');
    expect(result.approved).toBe(false);
    expect(result.generatedNothing).toBe(true);
    expect(result.generation.attempted).toBe(false);
    expect(result.generation.allowed).toBe(false);
    expect(result.validation.valid).toBe(true);
    expect(result.resolved.capabilities).toEqual([...AUTH_STACK].sort());
    expect(result.resolved.ordered).toEqual(['infrastructure.postgres', 'database', 'auth']);
    expect(result.dependencies.find((item) => item.capability === 'auth')?.requires).toContain('database');
  });

  it('ignores a client-supplied approved flag and resolved set', () => {
    const result = buildProjectConfiguration(
      {
        capabilities: [...AUTH_STACK],
        ...( {
          approved: true,
          resolved: { capabilities: ['kubernetes'] },
          generatedNothing: false,
        } as Record<string, unknown> ),
      } as never,
      { intent: 'validate' },
    );

    expect(result.approved).toBe(false);
    expect(result.generatedNothing).toBe(true);
    expect(result.resolved.capabilities).toEqual([...AUTH_STACK].sort());
    expect(result.resolved.capabilities).not.toContain('kubernetes');
  });

  it('rejects unknown capabilities', () => {
    const result = buildProjectConfiguration(
      { capabilities: ['not-a-real-capability'] },
      { intent: 'validate' },
    );

    expect(result.validation.valid).toBe(false);
    expect(result.status).toBe('invalid');
    expect(result.validation.capabilityExistence.unknown).toEqual(['not-a-real-capability']);
    expect(result.validation.issues.some((issue) => issue.code === 'unknown-capability')).toBe(true);
  });

  it('does not auto-enable missing dependencies unless closeDependencies is set', () => {
    const open = buildProjectConfiguration({ capabilities: ['copilot'] }, { intent: 'validate' });
    expect(open.validation.valid).toBe(false);
    expect(open.validation.missingDependencies).toEqual(['ai', 'ai.guardrails']);
    expect(open.resolved.capabilities).toEqual(['copilot']);

    const closed = buildProjectConfiguration(
      { capabilities: ['copilot'], closeDependencies: true },
      { intent: 'validate' },
    );
    expect(closed.proposed.closeDependencies).toBe(true);
    expect(closed.resolved.capabilities).toEqual(expect.arrayContaining(['ai', 'ai.guardrails', 'copilot']));
    expect(closed.reasons.some((item) => item.source === 'dependency-closure')).toBe(true);
  });

  it('rejects unimplemented kubernetes and microservices modes', () => {
    const kubernetes = buildProjectConfiguration(
      { capabilities: [...AUTH_STACK], deploymentMode: 'deployment.kubernetes' },
      { intent: 'validate' },
    );
    expect(kubernetes.validation.valid).toBe(false);
    expect(kubernetes.validation.unimplementedModes).toContain('deployment.kubernetes');
    expect(kubernetes.validation.issues.some((issue) => issue.code === 'unimplemented-mode')).toBe(true);

    const microservices = buildProjectConfiguration(
      { capabilities: [...AUTH_STACK], architectureMode: 'architecture.microservices' },
      { intent: 'validate' },
    );
    expect(microservices.validation.valid).toBe(false);
    expect(microservices.validation.issues.some((issue) => issue.code === 'unimplemented-mode')).toBe(true);
  });

  it('rejects architecture modes listed as capabilities', () => {
    const result = buildProjectConfiguration(
      { capabilities: ['architecture.modular-monolith', ...AUTH_STACK] },
      { intent: 'validate' },
    );
    expect(result.validation.valid).toBe(false);
    expect(result.validation.issues.some((issue) => issue.code === 'mode-in-capability-list')).toBe(true);
  });

  it('applies a profile when no capabilities are listed', () => {
    const result = buildProjectConfiguration(
      { profiles: [PROFILE_NAMES.basicWeb] },
      { intent: 'validate' },
    );
    expect(result.validation.valid).toBe(true);
    expect(result.resolved.profiles).toEqual([PROFILE_NAMES.basicWeb]);
    expect(result.resolved.capabilities).toContain('auth');
    expect(result.resolved.capabilities).toContain('infrastructure.postgres');
  });

  it('lets an explicit capability list omit profile members', () => {
    const result = buildProjectConfiguration(
      {
        profiles: [PROFILE_NAMES.basicWeb],
        capabilities: [...AUTH_STACK],
      },
      { intent: 'validate' },
    );
    expect(result.validation.valid).toBe(true);
    expect(result.resolved.capabilities).toEqual([...AUTH_STACK].sort());
    expect(result.notes.some((note) => note.startsWith('Profile members not selected:'))).toBe(true);
  });

  it('reports feature availability without treating a currently-off flag as invalid', () => {
    const result = buildProjectConfiguration(
      { capabilities: ['rag', 'ai', 'ai.guardrails'], closeDependencies: true },
      {
        intent: 'validate',
        featureConfig: {
          features: { rag: false, ai: false } as never,
        },
      },
    );

    const rag = result.validation.featureAvailability.find((item) => item.capability === 'rag');
    expect(rag?.known).toBe(true);
    expect(rag?.envVar).toBe('FEATURE_RAG');
    expect(rag?.currentlyEnabled).toBe(false);
    expect(result.featureFlags.some((flag) => flag.name === 'FEATURE_RAG' && flag.suggested)).toBe(true);
  });

  it('attaches recommendation reasons from a structured analysis', () => {
    const result = buildProjectConfiguration(
      {
        analysis: analysisSimpleSearch(),
        capabilities: [...AUTH_STACK, 'database'],
      },
      { intent: 'validate' },
    );
    expect(result.requirements.length).toBeGreaterThan(0);
    expect(result.reasons.some((item) => item.source === 'recommendation')).toBe(true);
  });

  it('is deterministic for shuffled capability input', () => {
    const left = buildProjectConfiguration(
      { capabilities: ['infrastructure.postgres', 'auth', 'database'], title: 'A' },
      { intent: 'validate', id: () => 'same' },
    );
    const right = buildProjectConfiguration(
      { capabilities: ['database', 'infrastructure.postgres', 'auth'], title: 'A' },
      { intent: 'validate', id: () => 'same' },
    );
    expect(left.resolved).toEqual(right.resolved);
    expect(left.validation.issues).toEqual(right.validation.issues);
    expect(left.integrity.digest).toBe(right.integrity.digest);
    expect(left.integrity.digest).toBe(configurationIntegrity(left));
  });

  it('approves a valid selection with a timestamp and refuses invalid approval', () => {
    const approved = buildProjectConfiguration(
      { capabilities: [...AUTH_STACK], title: 'Ready' },
      {
        intent: 'approve',
        userId: 'user-1',
        id: () => 'approved-1',
        now: () => new Date('2026-09-04T00:00:00.000Z'),
      },
    );
    expect(approved.approved).toBe(true);
    expect(approved.status).toBe('approved');
    expect(approved.approvedBy).toBe('user-1');
    expect(approved.approvedAt).toBe('2026-09-04T00:00:00.000Z');
    expect(approved.generatedNothing).toBe(true);
    expect(() => assertApprovedConfiguration(approved)).not.toThrow();

    expect(() =>
      buildProjectConfiguration({ capabilities: ['copilot'] }, { intent: 'approve' }),
    ).toThrow(ValidationError);

    expect(() =>
      buildProjectConfiguration({ capabilities: [] }, { intent: 'approve' }),
    ).toThrow(ValidationError);
  });

  it('surfaces selected conflicts from the catalog graph', () => {
    const result = buildProjectConfiguration(
      {
        capabilities: ['architecture.modular-monolith', 'architecture.microservices'],
      },
      { intent: 'validate' },
    );
    expect(result.validation.issues.some((issue) => issue.code === 'mode-in-capability-list')).toBe(true);
  });
});
