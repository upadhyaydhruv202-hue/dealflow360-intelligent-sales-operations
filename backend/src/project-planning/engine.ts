import { createHash, randomUUID } from 'node:crypto';

import {
  DEFAULT_ARCHITECTURE_MODE,
  DEFAULT_DEPLOYMENT_MODES,
  PLATFORM_CAPABILITIES,
  PLATFORM_VERSION,
  buildCapabilityGraph,
  compareCapabilityNames,
  requiredClosure,
  resolveCapabilities,
  resolveProfiles,
  uniqueSortedNames,
  type CapabilityDefinition,
  type CapabilityGraph,
  type ProfileIssue,
} from '../capabilities';
import { recommendCapabilities } from '../capability-recommendations';
import type {
  CapabilityRecommendationInput,
  CapabilityRecommendationResult,
} from '../capability-recommendations';
import { FEATURE_REGISTRY, isFeatureName } from '../features';
import { ValidationError } from '../errors';
import { PROJECT_CONFIGURATION_SCHEMA_VERSION, UNIMPLEMENTED_MODES } from './types';
import type {
  BuildProjectConfigurationOptions,
  FeatureAvailabilityItem,
  PlanningIssue,
  ProjectCapabilityReason,
  ProjectConfiguration,
  ProjectConflict,
  ProjectDependency,
  ProjectPlanningSelectionInput,
  ProjectRequirement,
} from './types';

const GENERATION_NOTE =
  'Phase 10 produces a validated Project Configuration only. It does not generate code, write .env, or enable FEATURE_*. Phase 11 (project generator) consumes this object and must re-validate it.';

const MODE_KINDS = new Set(['architecture-mode', 'deployment-mode']);

export function isUnimplementedMode(name: string): boolean {
  return (UNIMPLEMENTED_MODES as readonly string[]).includes(name);
}

export function buildProjectConfiguration(
  input: ProjectPlanningSelectionInput,
  options: BuildProjectConfigurationOptions,
): ProjectConfiguration {
  const catalog = PLATFORM_CAPABILITIES;
  const byName = new Map(catalog.map((capability) => [capability.name, capability]));
  const graph = buildCapabilityGraph(catalog);
  const modeNames = new Set(
    catalog.filter((capability) => MODE_KINDS.has(capability.kind)).map((capability) => capability.name),
  );

  const proposedCapabilities = uniqueSortedNames(input.capabilities ?? []);
  const proposedProfiles = uniqueSortedNames(input.profiles ?? []);
  const architectureMode = input.architectureMode?.trim() || DEFAULT_ARCHITECTURE_MODE;
  const deploymentMode = input.deploymentMode?.trim() || DEFAULT_DEPLOYMENT_MODES[0];
  const includeOptional = input.includeOptional === true;
  const closeDependencies = input.closeDependencies === true;

  const issues: PlanningIssue[] = [];

  const modesInList = proposedCapabilities.filter((name) => modeNames.has(name));
  for (const name of modesInList) {
    issues.push({
      code: 'mode-in-capability-list',
      severity: 'error',
      capability: name,
      message: `Architecture and deployment modes must be chosen separately, not listed as capabilities ("${name}")`,
    });
  }

  const unknownFromProposal = proposedCapabilities.filter(
    (name) => !modeNames.has(name) && !byName.has(name),
  );
  for (const name of unknownFromProposal) {
    issues.push({
      code: 'unknown-capability',
      severity: 'error',
      capability: name,
      message: `Capability "${name}" is not registered`,
    });
  }

  for (const mode of [architectureMode, deploymentMode]) {
    if (isUnimplementedMode(mode)) {
      issues.push({
        code: 'unimplemented-mode',
        severity: 'error',
        capability: mode,
        message: `Mode "${mode}" is experimental and unimplemented. Phase 10 will not approve it.`,
      });
    }
  }

  const explicitCapabilities = proposedCapabilities.filter((name) => !modeNames.has(name) && byName.has(name));

  const profileResolution = resolveProfiles({
    profiles: proposedProfiles,
    selected: [],
    includeOptional,
    closeDependencies: false,
    architectureMode,
    deploymentMode,
    capabilities: catalog,
  });
  issues.push(...profileResolution.issues.map(toPlanningIssue));

  let selected = explicitCapabilities;
  if (explicitCapabilities.length === 0 && proposedProfiles.length > 0) {
    selected = [...profileResolution.composed];
  }

  if (closeDependencies) {
    const knownSelected = selected.filter((name) => byName.has(name));
    selected = uniqueSortedNames([...selected, ...requiredClosure(graph, knownSelected)]);
  }

  if (selected.length === 0) {
    issues.push({
      code: 'empty-selection',
      severity: options.intent === 'approve' ? 'error' : 'warning',
      message: 'Select at least one catalog capability (or a profile) before approval',
    });
  }

  const infrastructure = impliedInfrastructure(selected, deploymentMode);
  const capabilityResolution = resolveCapabilities({
    capabilities: catalog,
    selected,
    architectureMode,
    deploymentMode,
    ...(infrastructure.length > 0 ? { infrastructure } : {}),
  });
  issues.push(...capabilityResolution.issues.map(toPlanningIssue));

  const featureAvailability = collectFeatureAvailability(selected, byName, options.featureConfig);
  for (const item of featureAvailability) {
    if (!item.known) {
      issues.push({
        code: 'unknown-feature-flag',
        severity: 'warning',
        capability: item.capability,
        related: item.featureFlag,
        message: `Capability "${item.capability}" names feature flag "${item.featureFlag}" which is not in FEATURE_REGISTRY`,
      });
    }
  }

  const recommendations =
    options.recommendations ??
    recommendationsFromInput(input.analysis, input.statement);

  const errorIssues = issues.filter((issue) => issue.severity === 'error');
  const valid = errorIssues.length === 0 && capabilityResolution.valid && profileResolution.valid;

  if (options.intent === 'approve' && !valid) {
    throw new ValidationError('Project configuration is not valid and cannot be approved', {
      issueCount: errorIssues.length,
      issues: errorIssues,
    });
  }

  const adapters = selected.filter((name) => byName.get(name)?.kind === 'adapter');
  const infrastructureSelected = selected.filter((name) => byName.get(name)?.kind === 'infrastructure');

  const omittedProfileMembers =
    proposedProfiles.length > 0 && explicitCapabilities.length > 0
      ? profileResolution.composed.filter((name) => !selected.includes(name))
      : [];

  const recommendedNames = recommendations
    ? uniqueSortedNames([
        ...recommendations.selected.capabilities,
        ...recommendations.selected.adapters,
        ...recommendations.selected.infrastructure,
      ])
    : [];
  const recommendedNotSelected = recommendedNames.filter((name) => !selected.includes(name));

  const notes = uniqueNotes([
    GENERATION_NOTE,
    'Frontend selections are proposals. This object is produced by backend validation.',
    closeDependencies
      ? 'Required dependencies were added because closeDependencies was true.'
      : 'Required dependencies were not auto-added. Missing names fail validation.',
    omittedProfileMembers.length
      ? `Profile members not selected: ${omittedProfileMembers.join(', ')}`
      : null,
    recommendedNotSelected.length
      ? `Recommended but not selected: ${recommendedNotSelected.join(', ')}`
      : null,
    valid
      ? 'The explicit selection validates against the capability and profile resolvers.'
      : 'The selection is invalid. Fix issues before approval.',
  ]);

  const now = options.now?.() ?? new Date();
  const id = options.id?.() ?? randomUUID();
  const approved = options.intent === 'approve' && valid;

  const resolved = {
    capabilities: [...capabilityResolution.selected],
    ordered: [...capabilityResolution.ordered],
    profiles: [...profileResolution.profiles],
    adapters,
    infrastructure: infrastructureSelected,
    architectureMode: capabilityResolution.architectureMode,
    deploymentMode: capabilityResolution.deploymentMode,
    required: [...capabilityResolution.required],
    missing: [...capabilityResolution.missing],
    optionalMissing: [...capabilityResolution.optionalMissing],
  };

  const configuration: ProjectConfiguration = {
    schemaVersion: PROJECT_CONFIGURATION_SCHEMA_VERSION,
    id,
    status: approved ? 'approved' : valid ? 'draft' : 'invalid',
    approved,
    generatedNothing: true,
    humanSelectionAuthoritative: true,
    catalogVersion: PLATFORM_VERSION,
    platformVersion: PLATFORM_VERSION,
    title: input.title?.trim() || null,
    problemSummary: problemSummaryFrom(input),
    requirements: requirementsFromAnalysis(input.analysis),
    proposed: {
      capabilities: proposedCapabilities,
      profiles: proposedProfiles,
      architectureMode,
      deploymentMode,
      includeOptional,
      closeDependencies,
    },
    resolved,
    reasons: collectReasons(selected, recommendations, byName, explicitCapabilities, closeDependencies),
    dependencies: collectDependencies(selected, graph),
    conflicts: collectConflicts(selected, graph),
    validation: {
      valid,
      permissionsOk: true,
      capabilityExistence: { unknown: uniqueSortedNames(unknownFromProposal) },
      missingDependencies: [...capabilityResolution.missing],
      conflicts: selectedConflicts(capabilityResolution.issues.map(toPlanningIssue).concat(issues)),
      compatibility: {
        architectureMode,
        deploymentMode,
        issues: issues.filter(
          (issue) =>
            issue.code === 'unsupported-architecture-mode' ||
            issue.code === 'unsupported-deployment-mode' ||
            issue.code === 'unimplemented-mode' ||
            issue.code === 'unsupported-combination',
        ),
      },
      featureAvailability,
      unimplementedModes: [architectureMode, deploymentMode].filter(isUnimplementedMode),
      issues: sortIssues(issues),
    },
    featureFlags: suggestFeatureFlags(selected, byName),
    notes,
    generation: {
      allowed: false,
      attempted: false,
      note: GENERATION_NOTE,
    },
    integrity: {
      algorithm: 'sha256',
      digest: '',
    },
    approvedAt: approved ? now.toISOString() : null,
    approvedBy: approved ? (options.userId ?? null) : null,
  };

  configuration.integrity.digest = configurationIntegrity(configuration);
  return configuration;
}

export function assertApprovedConfiguration(configuration: ProjectConfiguration): void {
  if (!configuration.approved || configuration.status !== 'approved' || !configuration.validation.valid) {
    throw new ValidationError('Project configuration is not approved', {
      status: configuration.status,
      approved: configuration.approved,
      valid: configuration.validation.valid,
    });
  }
  if (configuration.generation.attempted || configuration.generation.allowed) {
    throw new ValidationError('Project configuration must not include generated code');
  }
  if (!configuration.generatedNothing) {
    throw new ValidationError('Project configuration claimed generation that Phase 10 does not perform');
  }
}

export function configurationIntegrity(
  configuration: Pick<ProjectConfiguration, 'schemaVersion' | 'catalogVersion' | 'platformVersion' | 'resolved'>,
): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        schemaVersion: configuration.schemaVersion,
        catalogVersion: configuration.catalogVersion,
        platformVersion: configuration.platformVersion,
        capabilities: configuration.resolved.capabilities,
        ordered: configuration.resolved.ordered,
        profiles: configuration.resolved.profiles,
        architectureMode: configuration.resolved.architectureMode,
        deploymentMode: configuration.resolved.deploymentMode,
      }),
    )
    .digest('hex');
}

function recommendationsFromInput(
  analysis?: CapabilityRecommendationInput | null,
  statement?: string,
): CapabilityRecommendationResult | null {
  if (analysis) {
    return recommendCapabilities(analysis);
  }
  if (statement?.trim()) {
    return recommendCapabilities({ problemSummary: statement.trim(), mappings: [] });
  }
  return null;
}

function problemSummaryFrom(input: ProjectPlanningSelectionInput): string | null {
  const specSummary = input.analysis?.spec?.problemSummary;
  if (typeof specSummary === 'string' && specSummary.trim() && specSummary !== 'unknown') {
    return specSummary.trim();
  }
  if (typeof input.analysis?.problemSummary === 'string' && input.analysis.problemSummary.trim()) {
    return input.analysis.problemSummary.trim();
  }
  if (input.statement?.trim()) {
    return input.statement.trim();
  }
  return null;
}

function requirementsFromAnalysis(analysis?: CapabilityRecommendationInput | null): ProjectRequirement[] {
  const mappings = analysis?.mappings ?? [];
  return mappings.map((mapping, index) => {
    const existing = 'existingCapability' in mapping ? mapping.existingCapability : undefined;
    const existingName =
      existing && typeof existing === 'object' && 'name' in existing
        ? String(existing.name)
        : typeof existing === 'string' && existing !== 'unknown'
          ? existing
          : null;
    const classification = 'classification' in mapping ? mapping.classification : null;
    const newLogic = mapping.newProblemLogic;
    return {
      id: `req-${index + 1}`,
      requirement: mapping.requirement,
      category: mapping.category ?? null,
      classification: typeof classification === 'string' ? classification : null,
      existingCapability: existingName,
      newProblemLogic: typeof newLogic === 'string' && newLogic !== 'unknown' ? newLogic : null,
      source: 'analysis' as const,
    };
  });
}

function collectReasons(
  selected: readonly string[],
  recommendations: CapabilityRecommendationResult | null,
  catalog: Map<string, CapabilityDefinition>,
  explicit: readonly string[],
  closedDependencies: boolean,
): ProjectCapabilityReason[] {
  const byRecommended = new Map<string, CapabilityRecommendationResult['capabilities'][number]>();
  if (recommendations) {
    const items = [
      ...recommendations.capabilities,
      ...recommendations.adapters,
      ...recommendations.infrastructure,
      ...recommendations.profiles,
      recommendations.architectureMode,
      recommendations.deploymentMode,
    ];
    for (const item of items) {
      byRecommended.set(item.capabilitySelected, item);
    }
  }

  const explicitSet = new Set(explicit);
  return selected
    .map((name) => {
      const recommended = byRecommended.get(name);
      const capability = catalog.get(name);
      const addedByClosure = closedDependencies && !explicitSet.has(name);
      if (recommended) {
        return {
          capability: name,
          requirementSatisfied: recommended.requirementSatisfied,
          reason: recommended.reason,
          source: 'recommendation' as const,
          confidence: recommended.confidence,
          alternative: recommended.alternative,
          dependencyImpact: recommended.dependencyImpact,
        };
      }
      return {
        capability: name,
        requirementSatisfied: addedByClosure ? 'Required dependency of the explicit selection' : 'Human-selected capability',
        reason: addedByClosure
          ? `Added because closeDependencies was true. ${capability?.summary ?? ''}`.trim()
          : capability?.summary ?? 'Added by human selection. The backend did not infer this from recommendations.',
        source: addedByClosure ? ('dependency-closure' as const) : ('human' as const),
        confidence: 1,
        alternative: { name: 'omit', reason: 'Deselect if this capability is not required. Missing dependencies will fail validation.' },
        dependencyImpact: {
          adds: [...(capability?.dependencies ?? [])],
          optional: [...(capability?.optionalDependencies ?? [])],
          missingIfSelected: (capability?.dependencies ?? []).filter((dependency) => !selected.includes(dependency)),
        },
      };
    })
    .sort((left, right) => compareCapabilityNames(left.capability, right.capability));
}

function collectDependencies(selected: readonly string[], graph: CapabilityGraph): ProjectDependency[] {
  return selected.map((name) => {
    const requires = [...(graph.adjacency[name] ?? [])];
    const optional = [...(graph.optionalAdjacency[name] ?? [])];
    return {
      capability: name,
      requires,
      optional,
      missing: requires.filter((dependency) => !selected.includes(dependency)),
    };
  });
}

function collectConflicts(selected: readonly string[], graph: CapabilityGraph): ProjectConflict[] {
  const selectedSet = new Set(selected);
  const seen = new Set<string>();
  const items: ProjectConflict[] = [];
  for (const name of selected) {
    for (const other of graph.conflictAdjacency[name] ?? []) {
      const key = [name, other].sort(compareCapabilityNames).join('|');
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      items.push({
        capability: name,
        conflictsWith: other,
        bothSelected: selectedSet.has(other),
      });
    }
  }
  return items.sort((left, right) => {
    const byCapability = compareCapabilityNames(left.capability, right.capability);
    return byCapability !== 0 ? byCapability : compareCapabilityNames(left.conflictsWith, right.conflictsWith);
  });
}

function collectFeatureAvailability(
  selected: readonly string[],
  catalog: Map<string, CapabilityDefinition>,
  featureConfig?: { features: Record<string, boolean> },
): FeatureAvailabilityItem[] {
  const items: FeatureAvailabilityItem[] = [];
  for (const name of selected) {
    const capability = catalog.get(name);
    if (!capability?.featureFlag) {
      continue;
    }
    const featureFlag = capability.featureFlag;
    const known = isFeatureName(featureFlag);
    items.push({
      capability: name,
      featureFlag,
      envVar: known ? FEATURE_REGISTRY[featureFlag].envVar : null,
      known,
      currentlyEnabled: Boolean(known && featureConfig?.features[featureFlag]),
      requiredBySelection: true,
    });
  }
  return items.sort((left, right) => compareCapabilityNames(left.capability, right.capability));
}

function suggestFeatureFlags(
  selected: readonly string[],
  catalog: Map<string, CapabilityDefinition>,
): Array<{ name: string; suggested: boolean; reason: string; capability: string }> {
  const flags: Array<{ name: string; suggested: boolean; reason: string; capability: string }> = [];
  const seen = new Set<string>();
  for (const name of selected) {
    const capability = catalog.get(name);
    if (!capability?.featureFlag || !isFeatureName(capability.featureFlag)) {
      continue;
    }
    const envVar = FEATURE_REGISTRY[capability.featureFlag].envVar;
    if (seen.has(envVar)) {
      continue;
    }
    seen.add(envVar);
    flags.push({
      name: envVar,
      suggested: true,
      reason: `Advisory only. Set ${envVar}=true yourself if you accept ${name}. Planning does not write .env or enable the running process.`,
      capability: name,
    });
  }
  return flags.sort((left, right) => compareCapabilityNames(left.name, right.name));
}

function impliedInfrastructure(selected: readonly string[], deploymentMode: string): string[] {
  const tokens = selected
    .filter((name) => name.startsWith('infrastructure.'))
    .map((name) => name.slice('infrastructure.'.length));
  if (deploymentMode === 'deployment.docker-compose') {
    tokens.push('docker');
  }
  return uniqueSortedNames(tokens);
}

function selectedConflicts(issues: PlanningIssue[]): Array<{ a: string; b: string }> {
  const pairs: Array<{ a: string; b: string }> = [];
  const seen = new Set<string>();
  for (const issue of issues) {
    if (issue.code !== 'conflict' && issue.code !== 'profile-conflict') {
      continue;
    }
    const left = issue.capability ?? issue.profile;
    const right = issue.related;
    if (!left || !right) {
      continue;
    }
    const [a, b] = [left, right].sort(compareCapabilityNames);
    const key = `${a}|${b}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    pairs.push({ a, b });
  }
  return pairs;
}

function toPlanningIssue(issue: {
  code: string;
  severity: 'error' | 'warning';
  message: string;
  capability?: string;
  profile?: string;
  related?: string;
  details?: Record<string, unknown>;
}): PlanningIssue {
  return {
    code: issue.code as PlanningIssue['code'],
    severity: issue.severity,
    message: issue.message,
    capability: issue.capability,
    profile: 'profile' in issue ? (issue as ProfileIssue).profile : undefined,
    related: issue.related,
    details: issue.details,
  };
}

function sortIssues(issues: PlanningIssue[]): PlanningIssue[] {
  return [...issues].sort((left, right) => {
    const byCode = left.code.localeCompare(right.code);
    if (byCode !== 0) {
      return byCode;
    }
    return (left.capability ?? left.profile ?? left.message).localeCompare(
      right.capability ?? right.profile ?? right.message,
    );
  });
}

function uniqueNotes(notes: Array<string | null | undefined>): string[] {
  return [...new Set(notes.filter((note): note is string => Boolean(note)))];
}
