import type { CapabilityDefinition } from './types';

export const CAPABILITY_EDGE_KINDS = [
  'dependency',
  'optional-dependency',
  'conflict',
] as const;

export type CapabilityEdgeKind = (typeof CAPABILITY_EDGE_KINDS)[number];

export interface CapabilityGraphNode {
  name: string;
  kind: CapabilityDefinition['kind'];
  category: CapabilityDefinition['category'];
  maturity: CapabilityDefinition['maturity'];
  dependencies: readonly string[];
  optionalDependencies: readonly string[];
  conflicts: readonly string[];
  environmentRequirements: readonly string[];
  infrastructureRequirements: readonly string[];
  providerRequirements: readonly string[];
  architectureCompatibility: readonly string[];
  deploymentCompatibility: readonly string[];
}

export interface CapabilityGraphEdge {
  from: string;
  to: string;
  kind: CapabilityEdgeKind;
}

export interface CapabilityGraph {
  nodes: readonly CapabilityGraphNode[];
  edges: readonly CapabilityGraphEdge[];
  /** Required dependency adjacency: capability → sorted unique required names. */
  adjacency: Readonly<Record<string, readonly string[]>>;
  optionalAdjacency: Readonly<Record<string, readonly string[]>>;
  conflictAdjacency: Readonly<Record<string, readonly string[]>>;
}

const EDGE_KIND_ORDER: Record<CapabilityEdgeKind, number> = {
  dependency: 0,
  'optional-dependency': 1,
  conflict: 2,
};

export function compareCapabilityNames(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}

export function uniqueSortedNames(names: readonly string[]): string[] {
  return [...new Set(names)].sort(compareCapabilityNames);
}

export function buildCapabilityGraph(
  capabilities: readonly CapabilityDefinition[],
): CapabilityGraph {
  const ordered = [...capabilities].sort((left, right) =>
    compareCapabilityNames(left.name, right.name),
  );

  const nodes: CapabilityGraphNode[] = [];
  const edges: CapabilityGraphEdge[] = [];
  const adjacency: Record<string, string[]> = {};
  const optionalAdjacency: Record<string, string[]> = {};
  const conflictAdjacency: Record<string, string[]> = {};

  for (const capability of ordered) {
    const dependencies = uniqueSortedNames(capability.dependencies);
    const required = new Set(dependencies);
    const optionalDependencies = uniqueSortedNames(capability.optionalDependencies).filter(
      (name) => !required.has(name),
    );
    const conflicts = uniqueSortedNames(capability.conflicts);

    nodes.push({
      name: capability.name,
      kind: capability.kind,
      category: capability.category,
      maturity: capability.maturity,
      dependencies,
      optionalDependencies,
      conflicts,
      environmentRequirements: uniqueSortedNames(capability.environmentRequirements),
      infrastructureRequirements: uniqueSortedNames(capability.infrastructureRequirements),
      providerRequirements: uniqueSortedNames(capability.providerRequirements),
      architectureCompatibility: uniqueSortedNames(capability.architectureCompatibility),
      deploymentCompatibility: uniqueSortedNames(capability.deploymentCompatibility),
    });

    adjacency[capability.name] = dependencies;
    optionalAdjacency[capability.name] = optionalDependencies;
    conflictAdjacency[capability.name] = conflicts;

    for (const to of dependencies) {
      edges.push({ from: capability.name, to, kind: 'dependency' });
    }
    for (const to of optionalDependencies) {
      edges.push({ from: capability.name, to, kind: 'optional-dependency' });
    }
    for (const to of conflicts) {
      edges.push({ from: capability.name, to, kind: 'conflict' });
    }
  }

  edges.sort(compareEdges);

  return {
    nodes,
    edges,
    adjacency,
    optionalAdjacency,
    conflictAdjacency,
  };
}

export function requiredClosure(graph: CapabilityGraph, names: readonly string[]): string[] {
  const known = nodeNames(graph);
  const seen = new Set<string>();
  const stack = uniqueSortedNames(names).filter((name) => known.has(name));

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || seen.has(current)) {
      continue;
    }
    seen.add(current);
    for (const dependency of graph.adjacency[current] ?? []) {
      if (!seen.has(dependency) && known.has(dependency)) {
        stack.push(dependency);
      }
    }
  }

  return [...seen].sort(compareCapabilityNames);
}

/**
 * Kahn topological order of `names` that exist in the graph.
 * Only required edges whose both ends are in the name set contribute indegree.
 * Tie-break: lexicographically smallest ready name first.
 * Nodes in a cycle among the name set are omitted.
 */
export function topologicalOrder(graph: CapabilityGraph, names: readonly string[]): string[] {
  const selected = uniqueSortedNames(names).filter((name) => Boolean(graph.adjacency[name]));
  const selectedSet = new Set(selected);
  const indegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();

  for (const name of selected) {
    indegree.set(name, 0);
    dependents.set(name, []);
  }

  for (const name of selected) {
    for (const dependency of graph.adjacency[name] ?? []) {
      if (!selectedSet.has(dependency)) {
        continue;
      }
      indegree.set(name, (indegree.get(name) ?? 0) + 1);
      dependents.get(dependency)?.push(name);
    }
  }

  for (const [name, list] of dependents) {
    dependents.set(name, uniqueSortedNames(list));
  }

  const ready = selected.filter((name) => indegree.get(name) === 0);
  const ordered: string[] = [];

  while (ready.length > 0) {
    const current = ready.shift();
    if (!current) {
      break;
    }
    ordered.push(current);
    for (const dependent of dependents.get(current) ?? []) {
      const next = (indegree.get(dependent) ?? 0) - 1;
      indegree.set(dependent, next);
      if (next === 0) {
        insertSorted(ready, dependent);
      }
    }
  }

  return ordered;
}

export function findCircularDependencies(
  graph: CapabilityGraph,
  names: readonly string[] = graph.nodes.map((node) => node.name),
): string[][] {
  const scope = uniqueSortedNames(names).filter((name) => Boolean(graph.adjacency[name]));
  const scopeSet = new Set(scope);
  const white = new Set(scope);
  const gray = new Set<string>();
  const black = new Set<string>();
  const parent = new Map<string, string>();
  const cycles: string[][] = [];
  const seen = new Set<string>();

  const visit = (node: string) => {
    white.delete(node);
    gray.add(node);

    for (const dependency of graph.adjacency[node] ?? []) {
      if (!scopeSet.has(dependency)) {
        continue;
      }
      if (black.has(dependency)) {
        continue;
      }
      if (gray.has(dependency)) {
        const cycle = walkCycle(parent, node, dependency);
        const canonical = canonicalizeCycle(cycle);
        const key = canonical.join('\0');
        if (!seen.has(key)) {
          seen.add(key);
          cycles.push(canonical);
        }
        continue;
      }
      parent.set(dependency, node);
      visit(dependency);
    }

    gray.delete(node);
    black.add(node);
  };

  for (const node of scope) {
    if (white.has(node)) {
      visit(node);
    }
  }

  return cycles.sort((left, right) => {
    const length = left.length - right.length;
    if (length !== 0) {
      return length;
    }
    return compareCapabilityNames(left.join('→'), right.join('→'));
  });
}

function nodeNames(graph: CapabilityGraph): Set<string> {
  return new Set(graph.nodes.map((node) => node.name));
}

function compareEdges(left: CapabilityGraphEdge, right: CapabilityGraphEdge): number {
  const from = compareCapabilityNames(left.from, right.from);
  if (from !== 0) {
    return from;
  }
  const kind = EDGE_KIND_ORDER[left.kind] - EDGE_KIND_ORDER[right.kind];
  if (kind !== 0) {
    return kind;
  }
  return compareCapabilityNames(left.to, right.to);
}

function insertSorted(names: string[], name: string): void {
  let index = 0;
  while (index < names.length && compareCapabilityNames(names[index] ?? '', name) < 0) {
    index += 1;
  }
  names.splice(index, 0, name);
}

function walkCycle(parent: Map<string, string>, from: string, backTo: string): string[] {
  const cycle = [backTo];
  let cursor = from;
  while (cursor !== backTo) {
    cycle.push(cursor);
    const next = parent.get(cursor);
    if (!next) {
      break;
    }
    cursor = next;
  }
  cycle.push(backTo);
  cycle.reverse();
  return cycle;
}

function canonicalizeCycle(cycle: string[]): string[] {
  if (cycle.length < 2) {
    return cycle;
  }
  const body = cycle.slice(0, -1);
  let minIndex = 0;
  for (let index = 1; index < body.length; index += 1) {
    if (compareCapabilityNames(body[index] ?? '', body[minIndex] ?? '') < 0) {
      minIndex = index;
    }
  }
  const rotated = [...body.slice(minIndex), ...body.slice(0, minIndex), body[minIndex] ?? ''];
  return rotated;
}
