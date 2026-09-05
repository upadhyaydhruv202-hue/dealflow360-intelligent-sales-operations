import type { CapabilityDefinition, CapabilityRegistry } from '../capabilities';
import { CAPABILITY_ALIASES, normalizeCapabilityRef } from './aliases';
import { UNKNOWN_VALUE, type Unknownable, type UnknownableList } from './types';
import type { ClassifiedMapping, RequirementMappingDraft } from './types';

export function isUnknown(value: unknown): value is typeof UNKNOWN_VALUE {
  return value === UNKNOWN_VALUE;
}

export function toUnknownableList<T>(value: Unknownable<T[]>): UnknownableList<T> {
  if (isUnknown(value)) {
    return { determined: false, items: [] };
  }

  return { determined: true, items: value };
}

export function resolveCatalogCapability(
  proposed: string,
  registry: CapabilityRegistry,
): { capability: CapabilityDefinition } | { unknown: true } | { hallucinated: string } {
  const trimmed = proposed.trim();
  if (!trimmed || isUnknown(trimmed)) {
    return { unknown: true };
  }

  const normalized = normalizeCapabilityRef(trimmed);
  const aliased = CAPABILITY_ALIASES[normalized] ?? normalized;
  const exact = findCapability(registry, aliased) ?? findCapability(registry, normalized);
  if (exact) {
    return { capability: exact };
  }

  return { hallucinated: trimmed };
}

export function classifyMappings(
  drafts: readonly RequirementMappingDraft[],
  registry: CapabilityRegistry,
): { mappings: ClassifiedMapping[]; uncertainty: string[] } {
  const mappings: ClassifiedMapping[] = [];
  const uncertainty: string[] = [];

  for (const draft of drafts) {
    const resolved = resolveCatalogCapability(draft.existingCapability, registry);
    const newLogic =
      !isUnknown(draft.newProblemLogic) && draft.newProblemLogic.trim()
        ? draft.newProblemLogic.trim()
        : null;

    if ('hallucinated' in resolved) {
      uncertainty.push(
        `AI cited unregistered capability "${resolved.hallucinated}". It was not treated as an existing platform capability.`,
      );
    }

    const existing =
      'capability' in resolved
        ? {
            name: resolved.capability.name,
            summary: resolved.capability.summary,
            maturity: resolved.capability.maturity,
          }
        : null;

    let classification: ClassifiedMapping['classification'] = 'unknown';
    if (existing && newLogic) {
      classification = 'both';
    } else if (existing) {
      classification = 'existing_capability';
    } else if (newLogic) {
      classification = 'new_problem_logic';
    }

    mappings.push({
      requirement: draft.requirement,
      category: draft.category,
      classification,
      existingCapability: existing,
      newProblemLogic: newLogic,
      hallucinatedCapability: 'hallucinated' in resolved ? resolved.hallucinated : null,
      confidence: draft.confidence,
      evidence: draft.evidence,
    });
  }

  return { mappings, uncertainty };
}

export function collectExistingCapabilities(
  mappings: readonly ClassifiedMapping[],
): Array<{ name: string; summary: string; requirements: string[] }> {
  const byName = new Map<string, { name: string; summary: string; requirements: string[] }>();

  for (const mapping of mappings) {
    if (!mapping.existingCapability) {
      continue;
    }

    const current = byName.get(mapping.existingCapability.name) ?? {
      name: mapping.existingCapability.name,
      summary: mapping.existingCapability.summary,
      requirements: [],
    };
    if (!current.requirements.includes(mapping.requirement)) {
      current.requirements.push(mapping.requirement);
    }
    byName.set(current.name, current);
  }

  return [...byName.values()].sort((left, right) => left.name.localeCompare(right.name));
}

export function collectNewProblemLogic(
  mappings: readonly ClassifiedMapping[],
): Array<{ requirement: string; logic: string }> {
  return mappings
    .filter((mapping) => Boolean(mapping.newProblemLogic))
    .map((mapping) => ({
      requirement: mapping.requirement,
      logic: mapping.newProblemLogic as string,
    }));
}

function findCapability(
  registry: CapabilityRegistry,
  name: string,
): CapabilityDefinition | undefined {
  const direct = registry.get(name);
  if (direct) {
    return direct;
  }

  const lowered = name.toLowerCase();
  return registry.list().find((capability) => capability.name.toLowerCase() === lowered);
}
