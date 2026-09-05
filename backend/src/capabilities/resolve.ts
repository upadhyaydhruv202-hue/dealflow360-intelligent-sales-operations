import { ValidationError } from '../errors';
import {
  DEFAULT_ARCHITECTURE_MODE,
  DEFAULT_DEPLOYMENT_MODES,
} from './types';
import type { CapabilityDefinition } from './types';
import {
  buildCapabilityGraph,
  compareCapabilityNames,
  findCircularDependencies,
  requiredClosure,
  topologicalOrder,
  uniqueSortedNames,
  type CapabilityGraph,
} from './graph';
import { PLATFORM_CAPABILITIES } from './catalog';

export const CAPABILITY_ISSUE_CODES = [
  'unknown-capability',
  'missing-dependency',
  'circular-dependency',
  'conflict',
  'unsupported-architecture-mode',
  'unsupported-deployment-mode',
  'missing-environment-variable',
  'missing-infrastructure',
  'unavailable-provider',
] as const;

export type CapabilityIssueCode = (typeof CAPABILITY_ISSUE_CODES)[number];

export type CapabilityIssueSeverity = 'error' | 'warning';

export interface CapabilityIssue {
  code: CapabilityIssueCode;
  severity: CapabilityIssueSeverity;
  capability: string;
  message: string;
  related?: string;
  details?: Record<string, unknown>;
}

/**
 * Explicit selection to validate. Nothing is inferred or enabled from this object.
 */
export interface CapabilityResolveRequest {
  selected: readonly string[];
  architectureMode?: string;
  deploymentMode?: string;
  /**
   * When provided (including `{}`), environmentRequirements of selected
   * capabilities are checked for non-empty values.
   */
  environment?: Readonly<Record<string, string | number | boolean | undefined | null>>;
  /**
   * When provided (including `[]`), infrastructureRequirements must all be listed.
   */
  infrastructure?: readonly string[];
  /**
   * When provided (including `[]`), at least one providerRequirement must match.
   */
  providers?: readonly string[];
}

export interface ResolveCapabilitiesInput extends CapabilityResolveRequest {
  capabilities?: readonly CapabilityDefinition[];
}

export interface CapabilityResolution {
  valid: boolean;
  architectureMode: string;
  deploymentMode: string;
  /** Unique, lexicographically sorted explicit selection. Never expanded. */
  selected: readonly string[];
  /** Deterministic topological order of known selected names. Cyclic names omitted. */
  ordered: readonly string[];
  /** Transitive required closure of known selected names. Not an enablement list. */
  required: readonly string[];
  /** Names in `required` that were not selected. */
  missing: readonly string[];
  /** Optional dependencies of selected names that were not selected. Not errors. */
  optionalMissing: readonly string[];
  graph: CapabilityGraph;
  issues: readonly CapabilityIssue[];
}

export function resolveCapabilities(input: ResolveCapabilitiesInput): CapabilityResolution {
  const capabilities = input.capabilities ?? PLATFORM_CAPABILITIES;
  const graph = buildCapabilityGraph(capabilities);
  const known = new Set(graph.nodes.map((node) => node.name));
  const nodesByName = new Map(graph.nodes.map((node) => [node.name, node]));

  const selected = uniqueSortedNames(input.selected.map((name) => name.trim()).filter(Boolean));
  const architectureMode = input.architectureMode?.trim() || DEFAULT_ARCHITECTURE_MODE;
  const deploymentMode = input.deploymentMode?.trim() || DEFAULT_DEPLOYMENT_MODES[0];

  const issues: CapabilityIssue[] = [];

  for (const name of selected) {
    if (!known.has(name)) {
      issues.push({
        code: 'unknown-capability',
        severity: 'error',
        capability: name,
        message: `Capability "${name}" is not registered`,
      });
    }
  }

  const knownSelected = selected.filter((name) => known.has(name));
  const required = requiredClosure(graph, knownSelected);
  const missing = required.filter((name) => !selected.includes(name));

  const optionalMissing = uniqueSortedNames(
    knownSelected.flatMap((name) => graph.optionalAdjacency[name] ?? []),
  ).filter((name) => !selected.includes(name));

  for (const name of knownSelected) {
    for (const dependency of graph.adjacency[name] ?? []) {
      if (selected.includes(dependency)) {
        continue;
      }
      if (!known.has(dependency)) {
        issues.push({
          code: 'unknown-capability',
          severity: 'error',
          capability: name,
          related: dependency,
          message: `Capability "${name}" depends on unknown capability "${dependency}"`,
        });
        continue;
      }
      issues.push({
        code: 'missing-dependency',
        severity: 'error',
        capability: name,
        related: dependency,
        message: `Capability "${name}" requires "${dependency}", which is not selected`,
      });
    }
  }

  for (const name of knownSelected) {
    for (const optional of graph.optionalAdjacency[name] ?? []) {
      if (selected.includes(optional) || known.has(optional)) {
        continue;
      }
      issues.push({
        code: 'unknown-capability',
        severity: 'warning',
        capability: name,
        related: optional,
        message: `Capability "${name}" lists unknown optional dependency "${optional}"`,
      });
    }
  }

  const conflictPairs = new Set<string>();
  for (const name of knownSelected) {
    for (const conflict of graph.conflictAdjacency[name] ?? []) {
      if (!selected.includes(conflict)) {
        continue;
      }
      const [left, right] = uniqueSortedNames([name, conflict]);
      const key = `${left}\0${right}`;
      if (conflictPairs.has(key)) {
        continue;
      }
      conflictPairs.add(key);
      issues.push({
        code: 'conflict',
        severity: 'error',
        capability: left ?? name,
        related: right,
        message: `Capabilities "${left}" and "${right}" conflict`,
      });
    }
  }

  const cycleScope = uniqueSortedNames([...knownSelected, ...required]);
  for (const cycle of findCircularDependencies(graph, cycleScope)) {
    issues.push({
      code: 'circular-dependency',
      severity: 'error',
      capability: cycle[0] ?? 'unknown',
      related: cycle.slice(1, -1)[0],
      message: `Circular dependency: ${cycle.join(' → ')}`,
      details: { cycle },
    });
  }

  const architectureModes = new Set(
    graph.nodes.filter((node) => node.kind === 'architecture-mode').map((node) => node.name),
  );
  const deploymentModes = new Set(
    graph.nodes.filter((node) => node.kind === 'deployment-mode').map((node) => node.name),
  );

  if (architectureModes.size > 0 && !architectureModes.has(architectureMode)) {
    issues.push({
      code: 'unsupported-architecture-mode',
      severity: 'error',
      capability: architectureMode,
      message: `Architecture mode "${architectureMode}" is not registered`,
    });
  }

  if (deploymentModes.size > 0 && !deploymentModes.has(deploymentMode)) {
    issues.push({
      code: 'unsupported-deployment-mode',
      severity: 'error',
      capability: deploymentMode,
      message: `Deployment mode "${deploymentMode}" is not registered`,
    });
  }

  const architectureModeKnown = architectureModes.size === 0 || architectureModes.has(architectureMode);
  const deploymentModeKnown = deploymentModes.size === 0 || deploymentModes.has(deploymentMode);

  for (const name of knownSelected) {
    const node = nodesByName.get(name);
    if (!node) {
      continue;
    }
    if (architectureModeKnown && !node.architectureCompatibility.includes(architectureMode)) {
      issues.push({
        code: 'unsupported-architecture-mode',
        severity: 'error',
        capability: name,
        related: architectureMode,
        message: `Capability "${name}" does not support architecture mode "${architectureMode}"`,
      });
    }
    if (deploymentModeKnown && !node.deploymentCompatibility.includes(deploymentMode)) {
      issues.push({
        code: 'unsupported-deployment-mode',
        severity: 'error',
        capability: name,
        related: deploymentMode,
        message: `Capability "${name}" does not support deployment mode "${deploymentMode}"`,
      });
    }
  }

  if (input.environment) {
    for (const name of knownSelected) {
      const node = nodesByName.get(name);
      if (!node) {
        continue;
      }
      for (const variable of node.environmentRequirements) {
        if (hasEnvValue(input.environment, variable)) {
          continue;
        }
        issues.push({
          code: 'missing-environment-variable',
          severity: 'error',
          capability: name,
          related: variable,
          message: `Capability "${name}" requires environment variable ${variable}`,
        });
      }
    }
  }

  if (input.infrastructure) {
    const available = new Set(input.infrastructure);
    for (const name of knownSelected) {
      const node = nodesByName.get(name);
      if (!node) {
        continue;
      }
      for (const requirement of node.infrastructureRequirements) {
        if (available.has(requirement)) {
          continue;
        }
        issues.push({
          code: 'missing-infrastructure',
          severity: 'error',
          capability: name,
          related: requirement,
          message: `Capability "${name}" requires infrastructure "${requirement}", which is not available`,
        });
      }
    }
  }

  if (input.providers) {
    const available = uniqueSortedNames(input.providers);
    const availableSet = new Set(available);
    for (const name of knownSelected) {
      const node = nodesByName.get(name);
      if (!node || node.providerRequirements.length === 0) {
        continue;
      }
      if (node.providerRequirements.some((provider) => availableSet.has(provider))) {
        continue;
      }
      issues.push({
        code: 'unavailable-provider',
        severity: 'error',
        capability: name,
        message: `Capability "${name}" requires one of: ${node.providerRequirements.join(', ')}`,
        details: {
          required: node.providerRequirements,
          available,
        },
      });
    }
  }

  const ordered = topologicalOrder(graph, knownSelected);
  const sortedIssues = issues.sort(compareIssues);
  const valid = sortedIssues.every((issue) => issue.severity !== 'error');

  return {
    valid,
    architectureMode,
    deploymentMode,
    selected,
    ordered,
    required,
    missing,
    optionalMissing,
    graph,
    issues: sortedIssues,
  };
}

export function assertCapabilityResolution(resolution: CapabilityResolution): CapabilityResolution {
  if (resolution.valid) {
    return resolution;
  }

  throw new ValidationError(
    'Capability selection is invalid',
    resolution.issues.map((issue) => ({
      path: issue.related ? `capabilities.${issue.capability}.${issue.code}` : `capabilities.${issue.capability}`,
      message: issue.message,
      code: issue.code,
    })),
  );
}

function hasEnvValue(
  environment: Readonly<Record<string, string | number | boolean | undefined | null>>,
  name: string,
): boolean {
  if (!Object.prototype.hasOwnProperty.call(environment, name)) {
    return false;
  }
  const value = environment[name];
  if (value === undefined || value === null) {
    return false;
  }
  if (typeof value === 'string' && value.trim() === '') {
    return false;
  }
  return true;
}

function compareIssues(left: CapabilityIssue, right: CapabilityIssue): number {
  const code = compareCapabilityNames(left.code, right.code);
  if (code !== 0) {
    return code;
  }
  const capability = compareCapabilityNames(left.capability, right.capability);
  if (capability !== 0) {
    return capability;
  }
  const related = compareCapabilityNames(left.related ?? '', right.related ?? '');
  if (related !== 0) {
    return related;
  }
  return compareCapabilityNames(left.message, right.message);
}

export type { CapabilityGraph, CapabilityGraphEdge, CapabilityGraphNode } from './graph';
export {
  buildCapabilityGraph,
  compareCapabilityNames,
  findCircularDependencies,
  requiredClosure,
  topologicalOrder,
  uniqueSortedNames,
} from './graph';
