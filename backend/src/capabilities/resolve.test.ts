import { describe, expect, it } from 'vitest';

import { ValidationError } from '../errors';
import { defineCapability } from './catalog/define';
import { PLATFORM_CAPABILITIES } from './catalog';
import { createCapabilityRegistry } from './registry';
import {
  assertCapabilityResolution,
  buildCapabilityGraph,
  findCircularDependencies,
  requiredClosure,
  resolveCapabilities,
  topologicalOrder,
} from './resolve';
import type { CapabilityDefinition } from './types';
import { DEFAULT_ARCHITECTURE_MODE } from './types';

function cap(
  name: string,
  overrides: Partial<CapabilityDefinition> = {},
): CapabilityDefinition {
  return defineCapability({
    name,
    kind: 'application',
    category: 'core',
    maturity: 'stable',
    summary: `Fixture ${name}`,
    documentation: ['docs/capabilities.md'],
    ...overrides,
  });
}

describe('capability dependency graph', () => {
  it('builds a deterministic graph with required, optional, and conflict edges', () => {
    const capabilities = [
      cap('zeta', { dependencies: ['alpha'], optionalDependencies: ['beta'], conflicts: ['omega'] }),
      cap('alpha'),
      cap('beta'),
      cap('omega'),
    ];

    const first = buildCapabilityGraph(capabilities);
    const second = buildCapabilityGraph([...capabilities].reverse());

    expect(first).toEqual(second);
    expect(first.nodes.map((node) => node.name)).toEqual(['alpha', 'beta', 'omega', 'zeta']);
    expect(first.edges).toEqual([
      { from: 'zeta', to: 'alpha', kind: 'dependency' },
      { from: 'zeta', to: 'beta', kind: 'optional-dependency' },
      { from: 'zeta', to: 'omega', kind: 'conflict' },
    ]);
    expect(first.adjacency.zeta).toEqual(['alpha']);
    expect(first.optionalAdjacency.zeta).toEqual(['beta']);
    expect(first.conflictAdjacency.zeta).toEqual(['omega']);
  });

  it('treats a name listed as both required and optional as required only', () => {
    const graph = buildCapabilityGraph([
      cap('app', { dependencies: ['db'], optionalDependencies: ['db', 'cache'] }),
      cap('db'),
      cap('cache'),
    ]);

    expect(graph.adjacency.app).toEqual(['db']);
    expect(graph.optionalAdjacency.app).toEqual(['cache']);
    expect(graph.edges.filter((edge) => edge.to === 'db').map((edge) => edge.kind)).toEqual(['dependency']);
  });

  it('computes a required closure without adding optional dependencies', () => {
    const graph = buildCapabilityGraph([
      cap('rbac', { dependencies: ['auth'] }),
      cap('auth', { dependencies: ['database'], optionalDependencies: ['otp'] }),
      cap('database'),
      cap('otp'),
    ]);

    expect(requiredClosure(graph, ['rbac'])).toEqual(['auth', 'database', 'rbac']);
    expect(requiredClosure(graph, ['rbac'])).not.toContain('otp');
  });

  it('orders selected capabilities deterministically regardless of input order', () => {
    const graph = buildCapabilityGraph([
      cap('rbac', { dependencies: ['auth', 'database'] }),
      cap('auth', { dependencies: ['database'] }),
      cap('database'),
    ]);

    const left = topologicalOrder(graph, ['rbac', 'auth', 'database']);
    const right = topologicalOrder(graph, ['database', 'rbac', 'auth']);

    expect(left).toEqual(['database', 'auth', 'rbac']);
    expect(right).toEqual(left);
  });

  it('breaks topological ties by capability name', () => {
    const graph = buildCapabilityGraph([cap('beta'), cap('alpha'), cap('delta')]);
    expect(topologicalOrder(graph, ['delta', 'beta', 'alpha'])).toEqual(['alpha', 'beta', 'delta']);
  });

  it('detects circular required dependencies in canonical form', () => {
    const graph = buildCapabilityGraph([
      cap('a', { dependencies: ['b'] }),
      cap('b', { dependencies: ['c'] }),
      cap('c', { dependencies: ['a'] }),
    ]);

    expect(findCircularDependencies(graph)).toEqual([['a', 'b', 'c', 'a']]);
  });

  it('detects a self-dependency as a cycle', () => {
    const graph = buildCapabilityGraph([cap('loop', { dependencies: ['loop'] })]);
    expect(findCircularDependencies(graph)).toEqual([['loop', 'loop']]);
  });

  it('omits cyclic selected names from topological order', () => {
    const graph = buildCapabilityGraph([
      cap('left', { dependencies: ['right'] }),
      cap('right', { dependencies: ['left'] }),
      cap('ok'),
    ]);

    expect(topologicalOrder(graph, ['left', 'right', 'ok'])).toEqual(['ok']);
  });
});

describe('resolveCapabilities', () => {
  it('accepts a closed selection and does not expand it', () => {
    const capabilities = [
      cap('database', { dependencies: ['infrastructure.postgres'] }),
      cap('infrastructure.postgres', { kind: 'infrastructure', category: 'infrastructure' }),
      cap('auth', { dependencies: ['database'], optionalDependencies: ['otp'] }),
      cap('otp'),
      cap('unrelated', { defaultEnabled: true }),
    ];

    const resolution = resolveCapabilities({
      capabilities,
      selected: ['auth', 'database', 'infrastructure.postgres'],
    });

    expect(resolution.valid).toBe(true);
    expect(resolution.selected).toEqual(['auth', 'database', 'infrastructure.postgres']);
    expect(resolution.ordered).toEqual(['infrastructure.postgres', 'database', 'auth']);
    expect(resolution.required).toEqual(['auth', 'database', 'infrastructure.postgres']);
    expect(resolution.missing).toEqual([]);
    expect(resolution.optionalMissing).toEqual(['otp']);
    expect(resolution.ordered).not.toContain('otp');
    expect(resolution.ordered).not.toContain('unrelated');
    expect(resolution.issues).toEqual([]);
  });

  it('never silently enables required or defaultEnabled capabilities', () => {
    const capabilities = [
      cap('copilot', { dependencies: ['ai', 'ai.guardrails'], defaultEnabled: false }),
      cap('ai', { dependencies: [], defaultEnabled: false }),
      cap('ai.guardrails', { dependencies: ['ai'], defaultEnabled: false }),
      cap('foundation', { defaultEnabled: true }),
    ];

    const resolution = resolveCapabilities({
      capabilities,
      selected: ['copilot'],
    });

    expect(resolution.valid).toBe(false);
    expect(resolution.selected).toEqual(['copilot']);
    expect(resolution.ordered).toEqual(['copilot']);
    expect(resolution.required).toEqual(['ai', 'ai.guardrails', 'copilot']);
    expect(resolution.missing).toEqual(['ai', 'ai.guardrails']);
    expect(resolution.issues.filter((issue) => issue.code === 'missing-dependency')).toEqual([
      expect.objectContaining({ capability: 'copilot', related: 'ai' }),
      expect.objectContaining({ capability: 'copilot', related: 'ai.guardrails' }),
    ]);
  });

  it('produces the same result when the selected list is shuffled', () => {
    const capabilities = [
      cap('reports', { dependencies: ['pdf', 'storage'] }),
      cap('pdf'),
      cap('storage'),
    ];

    const left = resolveCapabilities({
      capabilities,
      selected: ['reports', 'storage', 'pdf'],
    });
    const right = resolveCapabilities({
      capabilities,
      selected: ['pdf', 'reports', 'storage'],
    });

    expect(left).toEqual(right);
    expect(left.ordered).toEqual(['pdf', 'storage', 'reports']);
  });

  it('reports unknown selected names and unknown required dependencies', () => {
    const resolution = resolveCapabilities({
      capabilities: [cap('auth', { dependencies: ['missing.db'] })],
      selected: ['auth', 'not.registered'],
    });

    expect(resolution.valid).toBe(false);
    expect(resolution.issues.map((issue) => issue.code).sort()).toEqual([
      'unknown-capability',
      'unknown-capability',
    ]);
    expect(resolution.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ capability: 'not.registered', code: 'unknown-capability' }),
        expect.objectContaining({ capability: 'auth', related: 'missing.db', code: 'unknown-capability' }),
      ]),
    );
  });

  it('reports circular dependencies without enabling the missing cycle members', () => {
    const resolution = resolveCapabilities({
      capabilities: [
        cap('a', { dependencies: ['b'] }),
        cap('b', { dependencies: ['c'] }),
        cap('c', { dependencies: ['a'] }),
      ],
      selected: ['a'],
    });

    expect(resolution.valid).toBe(false);
    expect(resolution.selected).toEqual(['a']);
    expect(resolution.ordered).toEqual(['a']);
    expect(resolution.missing).toEqual(['b', 'c']);
    expect(resolution.issues.some((issue) => issue.code === 'circular-dependency')).toBe(true);
    expect(resolution.issues.some((issue) => issue.message === 'Circular dependency: a → b → c → a')).toBe(
      true,
    );
  });

  it('reports a conflict once when both capabilities are selected', () => {
    const resolution = resolveCapabilities({
      capabilities: [
        cap('architecture.modular-monolith', {
          kind: 'architecture-mode',
          category: 'architecture',
          conflicts: ['architecture.microservices'],
        }),
        cap('architecture.microservices', {
          kind: 'architecture-mode',
          category: 'architecture',
          conflicts: ['architecture.modular-monolith'],
          architectureCompatibility: ['architecture.microservices'],
          defaultEnabled: false,
        }),
      ],
      selected: ['architecture.microservices', 'architecture.modular-monolith'],
    });

    const conflicts = resolution.issues.filter((issue) => issue.code === 'conflict');
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.capability).toBe('architecture.microservices');
    expect(conflicts[0]?.related).toBe('architecture.modular-monolith');
    expect(resolution.valid).toBe(false);
  });

  it('detects unsupported architecture and deployment modes', () => {
    const capabilities = [
      cap('api', {
        architectureCompatibility: [DEFAULT_ARCHITECTURE_MODE],
        deploymentCompatibility: ['deployment.local-hybrid'],
      }),
      cap(DEFAULT_ARCHITECTURE_MODE, {
        kind: 'architecture-mode',
        category: 'architecture',
        architectureCompatibility: [DEFAULT_ARCHITECTURE_MODE],
      }),
      cap('architecture.microservices', {
        kind: 'architecture-mode',
        category: 'architecture',
        architectureCompatibility: ['architecture.microservices'],
        deploymentCompatibility: ['deployment.kubernetes'],
      }),
      cap('deployment.local-hybrid', {
        kind: 'deployment-mode',
        category: 'deployment',
        deploymentCompatibility: ['deployment.local-hybrid'],
      }),
      cap('deployment.kubernetes', {
        kind: 'deployment-mode',
        category: 'deployment',
        architectureCompatibility: [DEFAULT_ARCHITECTURE_MODE, 'architecture.microservices'],
        deploymentCompatibility: ['deployment.kubernetes'],
      }),
    ];

    const architecture = resolveCapabilities({
      capabilities,
      selected: ['api'],
      architectureMode: 'architecture.microservices',
      deploymentMode: 'deployment.local-hybrid',
    });
    const deployment = resolveCapabilities({
      capabilities,
      selected: ['api'],
      architectureMode: DEFAULT_ARCHITECTURE_MODE,
      deploymentMode: 'deployment.kubernetes',
    });
    const unknownMode = resolveCapabilities({
      capabilities,
      selected: ['api'],
      architectureMode: 'architecture.serverless',
      deploymentMode: 'deployment.nomad',
    });

    expect(architecture.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'unsupported-architecture-mode',
          capability: 'api',
          related: 'architecture.microservices',
        }),
      ]),
    );
    expect(deployment.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'unsupported-deployment-mode',
          capability: 'api',
          related: 'deployment.kubernetes',
        }),
      ]),
    );
    expect(unknownMode.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'unsupported-architecture-mode',
          capability: 'architecture.serverless',
        }),
        expect.objectContaining({
          code: 'unsupported-deployment-mode',
          capability: 'deployment.nomad',
        }),
      ]),
    );
  });

  it('detects missing environment variables only when an environment snapshot is provided', () => {
    const capabilities = [
      cap('auth', { environmentRequirements: ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'] }),
    ];

    const skipped = resolveCapabilities({ capabilities, selected: ['auth'] });
    const missing = resolveCapabilities({
      capabilities,
      selected: ['auth'],
      environment: { JWT_ACCESS_SECRET: '  ' },
    });
    const present = resolveCapabilities({
      capabilities,
      selected: ['auth'],
      environment: {
        JWT_ACCESS_SECRET: 'access',
        JWT_REFRESH_SECRET: 'refresh',
      },
    });

    expect(skipped.valid).toBe(true);
    expect(skipped.issues.some((issue) => issue.code === 'missing-environment-variable')).toBe(false);
    expect(missing.issues.filter((issue) => issue.code === 'missing-environment-variable')).toEqual([
      expect.objectContaining({ related: 'JWT_ACCESS_SECRET' }),
      expect.objectContaining({ related: 'JWT_REFRESH_SECRET' }),
    ]);
    expect(present.valid).toBe(true);
  });

  it('does not treat a false feature flag as a missing environment variable', () => {
    const resolution = resolveCapabilities({
      capabilities: [cap('ai', { environmentRequirements: ['FEATURE_AI'] })],
      selected: ['ai'],
      environment: { FEATURE_AI: false },
    });

    expect(resolution.valid).toBe(true);
  });

  it('detects missing infrastructure requirements when availability is provided', () => {
    const capabilities = [
      cap('database', { infrastructureRequirements: ['postgres'] }),
      cap('nginx', { infrastructureRequirements: ['docker', 'nginx'] }),
    ];

    const skipped = resolveCapabilities({
      capabilities,
      selected: ['database', 'nginx'],
    });
    const missing = resolveCapabilities({
      capabilities,
      selected: ['database', 'nginx'],
      infrastructure: ['docker'],
    });
    const available = resolveCapabilities({
      capabilities,
      selected: ['database', 'nginx'],
      infrastructure: ['postgres', 'docker', 'nginx'],
    });

    expect(skipped.valid).toBe(true);
    expect(missing.issues.filter((issue) => issue.code === 'missing-infrastructure')).toEqual([
      expect.objectContaining({ capability: 'database', related: 'postgres' }),
      expect.objectContaining({ capability: 'nginx', related: 'nginx' }),
    ]);
    expect(available.valid).toBe(true);
  });

  it('detects unavailable providers using OR semantics', () => {
    const capabilities = [
      cap('email', { providerRequirements: ['smtp', 'resend', 'brevo', 'mock'] }),
      cap('adapter.ai.gemini', {
        kind: 'adapter',
        category: 'adapter',
        providerRequirements: ['gemini'],
      }),
    ];

    const skipped = resolveCapabilities({
      capabilities,
      selected: ['email', 'adapter.ai.gemini'],
    });
    const mockOnly = resolveCapabilities({
      capabilities,
      selected: ['email', 'adapter.ai.gemini'],
      providers: ['mock'],
    });
    const both = resolveCapabilities({
      capabilities,
      selected: ['email', 'adapter.ai.gemini'],
      providers: ['mock', 'gemini'],
    });

    expect(skipped.valid).toBe(true);
    expect(mockOnly.issues.filter((issue) => issue.code === 'unavailable-provider')).toEqual([
      expect.objectContaining({
        capability: 'adapter.ai.gemini',
        details: { required: ['gemini'], available: ['mock'] },
      }),
    ]);
    expect(mockOnly.valid).toBe(false);
    expect(both.valid).toBe(true);
  });

  it('fails provider checks against an empty available list', () => {
    const resolution = resolveCapabilities({
      capabilities: [cap('email', { providerRequirements: ['mock'] })],
      selected: ['email'],
      providers: [],
    });

    expect(resolution.issues.some((issue) => issue.code === 'unavailable-provider')).toBe(true);
  });

  it('throws a ValidationError when the caller asserts an invalid resolution', () => {
    const resolution = resolveCapabilities({
      capabilities: [cap('rbac', { dependencies: ['auth'] }), cap('auth')],
      selected: ['rbac'],
    });

    expect(() => assertCapabilityResolution(resolution)).toThrow(ValidationError);
    expect(() => assertCapabilityResolution(resolution)).toThrow(/Capability selection is invalid/);
  });

  it('returns the resolution when asserting a valid selection', () => {
    const resolution = resolveCapabilities({
      capabilities: [cap('auth')],
      selected: ['auth'],
    });
    expect(assertCapabilityResolution(resolution)).toBe(resolution);
  });

  it('exposes graph and resolve on the registry without constructing services', () => {
    const registry = createCapabilityRegistry([
      cap('database'),
      cap('auth', { dependencies: ['database'] }),
    ]);

    expect(registry.graph().adjacency.auth).toEqual(['database']);
    const resolution = registry.resolve({ selected: ['auth', 'database'] });
    expect(resolution.valid).toBe(true);
    expect(resolution.ordered).toEqual(['database', 'auth']);
  });

  it('treats an empty selection as valid and does not enable catalog defaults', () => {
    const resolution = resolveCapabilities({
      capabilities: [cap('foundation', { defaultEnabled: true })],
      selected: [],
    });

    expect(resolution.valid).toBe(true);
    expect(resolution.selected).toEqual([]);
    expect(resolution.ordered).toEqual([]);
    expect(resolution.required).toEqual([]);
  });
});

describe('platform catalog integrity', () => {
  const graph = buildCapabilityGraph(PLATFORM_CAPABILITIES);
  const names = new Set(graph.nodes.map((node) => node.name));

  it('has no circular required dependencies', () => {
    expect(findCircularDependencies(graph)).toEqual([]);
  });

  it('references only registered names for dependencies, optional dependencies, and conflicts', () => {
    for (const node of graph.nodes) {
      for (const dependency of node.dependencies) {
        expect(names.has(dependency), `${node.name} depends on unknown ${dependency}`).toBe(true);
      }
      for (const optional of node.optionalDependencies) {
        expect(names.has(optional), `${node.name} optionally depends on unknown ${optional}`).toBe(true);
      }
      for (const conflict of node.conflicts) {
        expect(names.has(conflict), `${node.name} conflicts with unknown ${conflict}`).toBe(true);
      }
    }
  });

  it('lists architecture and deployment compatibility against registered modes', () => {
    const architectureModes = new Set(
      graph.nodes.filter((node) => node.kind === 'architecture-mode').map((node) => node.name),
    );
    const deploymentModes = new Set(
      graph.nodes.filter((node) => node.kind === 'deployment-mode').map((node) => node.name),
    );

    for (const node of graph.nodes) {
      for (const mode of node.architectureCompatibility) {
        expect(architectureModes.has(mode), `${node.name} lists unknown architecture ${mode}`).toBe(true);
      }
      for (const mode of node.deploymentCompatibility) {
        expect(deploymentModes.has(mode), `${node.name} lists unknown deployment ${mode}`).toBe(true);
      }
    }
  });

  it('resolves a closed auth stack from the platform catalog', () => {
    const resolution = resolveCapabilities({
      selected: ['auth', 'database', 'infrastructure.postgres'],
    });

    expect(resolution.valid).toBe(true);
    expect(resolution.ordered).toEqual(['infrastructure.postgres', 'database', 'auth']);
    expect(resolution.optionalMissing).toEqual(['infrastructure.redis', 'otp']);
  });

  it('does not silently enable AI when resolving copilot from the platform catalog', () => {
    const resolution = resolveCapabilities({ selected: ['copilot'] });

    expect(resolution.valid).toBe(false);
    expect(resolution.selected).toEqual(['copilot']);
    expect(resolution.ordered).toEqual(['copilot']);
    expect(resolution.missing).toEqual(['ai', 'ai.guardrails']);
    expect(resolution.issues.some((issue) => issue.code === 'missing-dependency')).toBe(true);
  });

  it('does not require environment from unselected dependencies', () => {
    const resolution = resolveCapabilities({
      selected: ['copilot'],
      environment: {},
    });

    const missingEnv = resolution.issues
      .filter((issue) => issue.code === 'missing-environment-variable')
      .map((issue) => issue.related);

    expect(missingEnv).toEqual(['FEATURE_COPILOT']);
    expect(missingEnv).not.toContain('GEMINI_API_KEY');
    expect(missingEnv).not.toContain('FEATURE_AI');
  });

  it('rejects experimental kubernetes unless that deployment mode is requested', () => {
    const kubernetes = resolveCapabilities({
      selected: ['deployment.kubernetes'],
    });
    const microservices = resolveCapabilities({
      selected: ['architecture.microservices'],
      architectureMode: 'architecture.microservices',
      deploymentMode: 'deployment.kubernetes',
    });

    expect(kubernetes.valid).toBe(false);
    expect(kubernetes.issues.some((issue) => issue.code === 'unsupported-deployment-mode')).toBe(true);
    expect(microservices.valid).toBe(true);
    expect(microservices.selected).toEqual(['architecture.microservices']);
  });
});
