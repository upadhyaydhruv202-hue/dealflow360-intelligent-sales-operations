import { ValidationError } from '../../errors';
import { PLATFORM_CAPABILITIES } from '../catalog';
import {
  buildCapabilityGraph,
  compareCapabilityNames,
  requiredClosure,
  uniqueSortedNames,
} from '../graph';
import {
  resolveCapabilities,
  type CapabilityIssue,
  type CapabilityResolution,
  type CapabilityResolveRequest,
} from '../resolve';
import { satisfiesSemver } from '../semver';
import type { CapabilityDefinition, CapabilityMaturity } from '../types';
import { DEFAULT_ARCHITECTURE_MODE, DEFAULT_DEPLOYMENT_MODES } from '../types';
import { PLATFORM_VERSION } from '../version';
import { PLATFORM_PROFILES } from './catalog';
import type { ProjectProfile, UnsupportedCombination, VersionCompatibility } from './types';

export const PROFILE_ISSUE_CODES = [
  'unknown-profile',
  'circular-profile-include',
  'profile-conflict',
  'incompatible-platform-version',
  'incompatible-capability-version',
  'incompatible-profile-version',
  'incompatible-plugin-version',
  'unsupported-maturity',
  'unsupported-combination',
  'missing-plugin',
] as const;

export type ProfileIssueCode = (typeof PROFILE_ISSUE_CODES)[number];

export type ProfileIssueSeverity = 'error' | 'warning';

export interface ProfileIssue {
  code: ProfileIssueCode | CapabilityIssue['code'];
  severity: ProfileIssueSeverity;
  message: string;
  profile?: string;
  capability?: string;
  related?: string;
  details?: Record<string, unknown>;
}

export interface PluginVersionRef {
  name: string;
  version?: string;
}

export interface ResolveProfilesInput {
  /** Optional profile names. Empty/omitted means capabilities-only selection. */
  profiles?: readonly string[];
  /** Extra capability names selected directly. Profiles are never required. */
  selected?: readonly string[];
  includeOptional?: boolean;
  /** When true, add the required closure of composed names before validation. */
  closeDependencies?: boolean;
  /** When set, any composed profile or capability outside this list is an error. */
  allowMaturities?: readonly CapabilityMaturity[];
  architectureMode?: string;
  deploymentMode?: string;
  environment?: CapabilityResolveRequest['environment'];
  infrastructure?: readonly string[];
  providers?: readonly string[];
  capabilities?: readonly CapabilityDefinition[];
  catalog?: readonly ProjectProfile[];
  plugins?: readonly PluginVersionRef[];
  platformVersion?: string;
}

export interface ProfileVersionSnapshot {
  platform: string;
  profiles: Readonly<Record<string, string>>;
  capabilities: Readonly<Record<string, string>>;
  plugins: Readonly<Record<string, string>>;
}

export interface ProfileResolution {
  valid: boolean;
  architectureMode: string;
  deploymentMode: string;
  /** Explicit profile names, unique and sorted. Never inferred. */
  profiles: readonly string[];
  /** Transitive includes that were not explicitly selected. */
  inheritedProfiles: readonly string[];
  /** Explicit + inherited profiles, unique and sorted. */
  expandedProfiles: readonly string[];
  /** Capability names produced by profiles before extras and optional includes. */
  inheritedCapabilities: readonly string[];
  /** Union of profile capabilities, extras, and optional includes. Not FEATURE_* enablement. */
  composed: readonly string[];
  /** Names passed to resolveCapabilities. */
  selected: readonly string[];
  versions: ProfileVersionSnapshot;
  capabilityResolution: CapabilityResolution;
  issues: readonly ProfileIssue[];
}

export function resolveProfiles(input: ResolveProfilesInput): ProfileResolution {
  const catalog = input.catalog ?? PLATFORM_PROFILES;
  const capabilities = input.capabilities ?? PLATFORM_CAPABILITIES;
  const platformVersion = input.platformVersion?.trim() || PLATFORM_VERSION;
  const architectureMode = input.architectureMode?.trim() || DEFAULT_ARCHITECTURE_MODE;
  const deploymentMode = input.deploymentMode?.trim() || DEFAULT_DEPLOYMENT_MODES[0];
  const includeOptional = input.includeOptional === true;
  const closeDependencies = input.closeDependencies === true;
  const allowMaturities = input.allowMaturities ? new Set(input.allowMaturities) : null;

  const profilesByName = new Map(catalog.map((profile) => [profile.name, profile]));
  const capabilitiesByName = new Map(
    capabilities.map((capability) => [capability.name, capability]),
  );
  const pluginsByName = new Map(
    (input.plugins ?? []).map((plugin) => [plugin.name, plugin.version?.trim() || '']),
  );

  const issues: ProfileIssue[] = [];
  const selectedProfiles = uniqueSortedNames(
    (input.profiles ?? []).map((name) => name.trim()).filter(Boolean),
  );
  const extraCapabilities = uniqueSortedNames(
    (input.selected ?? []).map((name) => name.trim()).filter(Boolean),
  );

  for (const name of selectedProfiles) {
    if (!profilesByName.has(name)) {
      issues.push({
        code: 'unknown-profile',
        severity: 'error',
        profile: name,
        message: `Profile "${name}" is not registered`,
      });
    }
  }

  const expansion = expandProfileIncludes(selectedProfiles, profilesByName);
  issues.push(...expansion.issues);

  const expandedProfiles = expansion.expanded;
  const inheritedProfiles = expandedProfiles.filter((name) => !selectedProfiles.includes(name));
  const knownExpanded = expandedProfiles
    .map((name) => profilesByName.get(name))
    .filter((profile): profile is ProjectProfile => Boolean(profile));

  issues.push(...collectIncludeVersionIssues(knownExpanded, profilesByName));
  issues.push(...collectProfileConflicts(knownExpanded));
  issues.push(...collectModeIssues(knownExpanded, architectureMode, deploymentMode));

  const inheritedCapabilities = uniqueSortedNames(
    knownExpanded.flatMap((profile) => [...profile.capabilities]),
  );
  const optionalFromProfiles = uniqueSortedNames(
    knownExpanded.flatMap((profile) => [...profile.optionalCapabilities]),
  );
  const composed = uniqueSortedNames([
    ...inheritedCapabilities,
    ...extraCapabilities,
    ...(includeOptional ? optionalFromProfiles : []),
  ]);

  issues.push(...collectCapabilityConflictIssues(knownExpanded, composed));
  issues.push(
    ...collectUnsupportedCombinations(
      knownExpanded,
      expandedProfiles,
      composed,
      architectureMode,
      deploymentMode,
    ),
  );
  issues.push(
    ...collectMaturityIssues(knownExpanded, composed, capabilitiesByName, allowMaturities),
  );
  issues.push(
    ...collectVersionIssues({
      profiles: knownExpanded,
      composed,
      capabilitiesByName,
      pluginsByName,
      platformVersion,
    }),
  );
  issues.push(...collectPluginIssues(knownExpanded, pluginsByName));

  let selected = composed;
  if (closeDependencies) {
    selected = requiredClosure(buildCapabilityGraph(capabilities), composed);
  }

  const capabilityResolution = resolveCapabilities({
    selected,
    architectureMode,
    deploymentMode,
    environment: input.environment,
    infrastructure: input.infrastructure,
    providers: input.providers,
    capabilities,
  });

  issues.push(...capabilityResolution.issues.map(toProfileIssue));

  const versions: ProfileVersionSnapshot = {
    platform: platformVersion,
    profiles: Object.fromEntries(knownExpanded.map((profile) => [profile.name, profile.version])),
    capabilities: Object.fromEntries(
      selected
        .map((name) => capabilitiesByName.get(name))
        .filter((capability): capability is CapabilityDefinition => Boolean(capability))
        .map((capability) => [capability.name, capability.version]),
    ),
    plugins: Object.fromEntries(
      [...pluginsByName.entries()].filter(([, version]) => Boolean(version)),
    ),
  };

  const sortedIssues = issues.sort(compareProfileIssues);
  const valid = sortedIssues.every((issue) => issue.severity !== 'error');

  return {
    valid,
    architectureMode,
    deploymentMode,
    profiles: selectedProfiles,
    inheritedProfiles,
    expandedProfiles,
    inheritedCapabilities,
    composed,
    selected,
    versions,
    capabilityResolution,
    issues: sortedIssues,
  };
}

export function assertProfileResolution(resolution: ProfileResolution): ProfileResolution {
  if (resolution.valid) {
    return resolution;
  }

  throw new ValidationError(
    'Project profile selection is invalid',
    resolution.issues.map((issue) => ({
      path: issuePath(issue),
      message: issue.message,
      code: issue.code,
    })),
  );
}

function expandProfileIncludes(
  selected: readonly string[],
  catalog: Map<string, ProjectProfile>,
): { expanded: string[]; issues: ProfileIssue[] } {
  const knownSelected = selected.filter((name) => catalog.has(name));
  const white = new Set(knownSelected);
  const gray = new Set<string>();
  const black = new Set<string>();
  const parent = new Map<string, string>();
  const seenCycles = new Set<string>();
  const issues: ProfileIssue[] = [];
  const visited = new Set<string>();

  const visit = (name: string) => {
    visited.add(name);
    white.delete(name);
    gray.add(name);

    const profile = catalog.get(name);
    for (const included of profile?.includes ?? []) {
      if (!catalog.has(included)) {
        issues.push({
          code: 'unknown-profile',
          severity: 'error',
          profile: name,
          related: included,
          message: `Profile "${name}" includes unknown profile "${included}"`,
        });
        continue;
      }

      if (black.has(included)) {
        continue;
      }
      if (gray.has(included)) {
        const cycle = canonicalizeCycle(walkCycle(parent, name, included));
        const key = cycle.join('\0');
        if (!seenCycles.has(key)) {
          seenCycles.add(key);
          issues.push({
            code: 'circular-profile-include',
            severity: 'error',
            profile: cycle[0] ?? name,
            related: cycle[1],
            message: `Circular profile include: ${cycle.join(' → ')}`,
            details: { cycle },
          });
        }
        continue;
      }

      parent.set(included, name);
      visit(included);
    }

    gray.delete(name);
    black.add(name);
  };

  for (const name of knownSelected) {
    if (white.has(name) || !black.has(name)) {
      visit(name);
    }
  }

  return {
    expanded: uniqueSortedNames([...visited]),
    issues,
  };
}

function collectIncludeVersionIssues(
  profiles: readonly ProjectProfile[],
  catalog: Map<string, ProjectProfile>,
): ProfileIssue[] {
  const issues: ProfileIssue[] = [];
  for (const profile of profiles) {
    const constraints = profile.compatibility.profiles ?? {};
    for (const included of profile.includes) {
      const range = constraints[included];
      if (!range) {
        continue;
      }
      const child = catalog.get(included);
      if (!child) {
        continue;
      }
      if (satisfiesSemver(child.version, range)) {
        continue;
      }
      issues.push({
        code: 'incompatible-profile-version',
        severity: 'error',
        profile: profile.name,
        related: included,
        message: `Profile "${profile.name}" requires "${included}" ${range}, but it is ${child.version}`,
        details: { required: range, actual: child.version },
      });
    }
  }
  return issues;
}

function collectProfileConflicts(profiles: readonly ProjectProfile[]): ProfileIssue[] {
  const selected = new Set(profiles.map((profile) => profile.name));
  const seen = new Set<string>();
  const issues: ProfileIssue[] = [];

  for (const profile of profiles) {
    for (const conflict of profile.conflictingProfiles) {
      if (!selected.has(conflict)) {
        continue;
      }
      const [left, right] = uniqueSortedNames([profile.name, conflict]);
      const key = `${left}\0${right}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      issues.push({
        code: 'profile-conflict',
        severity: 'error',
        profile: left,
        related: right,
        message: `Profiles "${left}" and "${right}" conflict`,
      });
    }
  }

  return issues;
}

function collectModeIssues(
  profiles: readonly ProjectProfile[],
  architectureMode: string,
  deploymentMode: string,
): ProfileIssue[] {
  const issues: ProfileIssue[] = [];
  for (const profile of profiles) {
    if (!profile.architectureCompatibility.includes(architectureMode)) {
      issues.push({
        code: 'unsupported-combination',
        severity: 'error',
        profile: profile.name,
        related: architectureMode,
        message: `Profile "${profile.name}" does not support architecture mode "${architectureMode}"`,
      });
    }
    if (!profile.deploymentCompatibility.includes(deploymentMode)) {
      issues.push({
        code: 'unsupported-combination',
        severity: 'error',
        profile: profile.name,
        related: deploymentMode,
        message: `Profile "${profile.name}" does not support deployment mode "${deploymentMode}"`,
      });
    }
  }
  return issues;
}

function collectCapabilityConflictIssues(
  profiles: readonly ProjectProfile[],
  composed: readonly string[],
): ProfileIssue[] {
  const selected = new Set(composed);
  const issues: ProfileIssue[] = [];
  for (const profile of profiles) {
    for (const conflict of profile.conflicts) {
      if (!selected.has(conflict)) {
        continue;
      }
      issues.push({
        code: 'profile-conflict',
        severity: 'error',
        profile: profile.name,
        capability: conflict,
        related: conflict,
        message: `Profile "${profile.name}" conflicts with capability "${conflict}"`,
      });
    }
  }
  return issues;
}

function collectUnsupportedCombinations(
  profiles: readonly ProjectProfile[],
  expandedProfiles: readonly string[],
  composed: readonly string[],
  architectureMode: string,
  deploymentMode: string,
): ProfileIssue[] {
  const profileSet = new Set(expandedProfiles);
  const capabilitySet = new Set(composed);
  const issues: ProfileIssue[] = [];

  for (const profile of profiles) {
    for (const rule of profile.incompatibleWith) {
      if (!combinationMatches(rule, profileSet, capabilitySet, architectureMode, deploymentMode)) {
        continue;
      }
      issues.push({
        code: 'unsupported-combination',
        severity: 'error',
        profile: profile.name,
        related: rule.capabilities?.[0] ?? rule.profiles?.[0] ?? rule.deploymentModes?.[0],
        message: rule.message,
        details: { ...rule },
      });
    }
  }

  return issues;
}

function combinationMatches(
  rule: UnsupportedCombination,
  profiles: ReadonlySet<string>,
  capabilities: ReadonlySet<string>,
  architectureMode: string,
  deploymentMode: string,
): boolean {
  if (rule.profiles?.length && !rule.profiles.every((name) => profiles.has(name))) {
    return false;
  }
  if (rule.capabilities?.length && !rule.capabilities.every((name) => capabilities.has(name))) {
    return false;
  }
  if (rule.architectureModes?.length && !rule.architectureModes.includes(architectureMode)) {
    return false;
  }
  if (rule.deploymentModes?.length && !rule.deploymentModes.includes(deploymentMode)) {
    return false;
  }
  return true;
}

function collectMaturityIssues(
  profiles: readonly ProjectProfile[],
  composed: readonly string[],
  capabilitiesByName: Map<string, CapabilityDefinition>,
  allowMaturities: Set<CapabilityMaturity> | null,
): ProfileIssue[] {
  const issues: ProfileIssue[] = [];

  const check = (name: string, maturity: CapabilityMaturity, kind: 'profile' | 'capability') => {
    if (maturity === 'experimental' || maturity === 'deprecated') {
      issues.push({
        code: 'unsupported-maturity',
        severity: allowMaturities && !allowMaturities.has(maturity) ? 'error' : 'warning',
        profile: kind === 'profile' ? name : undefined,
        capability: kind === 'capability' ? name : undefined,
        related: maturity,
        message: `${kind === 'profile' ? 'Profile' : 'Capability'} "${name}" is ${maturity}`,
      });
    } else if (allowMaturities && !allowMaturities.has(maturity)) {
      issues.push({
        code: 'unsupported-maturity',
        severity: 'error',
        profile: kind === 'profile' ? name : undefined,
        capability: kind === 'capability' ? name : undefined,
        related: maturity,
        message: `${kind === 'profile' ? 'Profile' : 'Capability'} "${name}" maturity "${maturity}" is not allowed`,
      });
    }
  };

  for (const profile of profiles) {
    check(profile.name, profile.maturity, 'profile');
  }
  for (const name of composed) {
    const capability = capabilitiesByName.get(name);
    if (capability) {
      check(capability.name, capability.maturity, 'capability');
    }
  }

  return issues;
}

function collectVersionIssues(input: {
  profiles: readonly ProjectProfile[];
  composed: readonly string[];
  capabilitiesByName: Map<string, CapabilityDefinition>;
  pluginsByName: Map<string, string>;
  platformVersion: string;
}): ProfileIssue[] {
  const issues: ProfileIssue[] = [];
  const composedSet = new Set(input.composed);

  for (const profile of input.profiles) {
    issues.push(
      ...compatibilityIssues(profile.name, profile.compatibility, {
        composedSet,
        capabilitiesByName: input.capabilitiesByName,
        pluginsByName: input.pluginsByName,
        platformVersion: input.platformVersion,
      }),
    );
  }

  return issues;
}

function compatibilityIssues(
  profileName: string,
  compatibility: VersionCompatibility,
  context: {
    composedSet: ReadonlySet<string>;
    capabilitiesByName: Map<string, CapabilityDefinition>;
    pluginsByName: Map<string, string>;
    platformVersion: string;
  },
): ProfileIssue[] {
  const issues: ProfileIssue[] = [];

  if (compatibility.platform && !satisfiesSemver(context.platformVersion, compatibility.platform)) {
    issues.push({
      code: 'incompatible-platform-version',
      severity: 'error',
      profile: profileName,
      related: context.platformVersion,
      message: `Profile "${profileName}" requires platform ${compatibility.platform}, but it is ${context.platformVersion}`,
      details: { required: compatibility.platform, actual: context.platformVersion },
    });
  }

  for (const [capabilityName, range] of Object.entries(compatibility.capabilities ?? {})) {
    if (!context.composedSet.has(capabilityName)) {
      continue;
    }
    const capability = context.capabilitiesByName.get(capabilityName);
    if (!capability) {
      continue;
    }
    if (satisfiesSemver(capability.version, range)) {
      continue;
    }
    issues.push({
      code: 'incompatible-capability-version',
      severity: 'error',
      profile: profileName,
      capability: capabilityName,
      related: capability.version,
      message: `Profile "${profileName}" requires "${capabilityName}" ${range}, but it is ${capability.version}`,
      details: { required: range, actual: capability.version },
    });
  }

  for (const [pluginName, range] of Object.entries(compatibility.plugins ?? {})) {
    const version = context.pluginsByName.get(pluginName);
    if (version === undefined) {
      continue;
    }
    if (!version) {
      issues.push({
        code: 'incompatible-plugin-version',
        severity: 'error',
        profile: profileName,
        related: pluginName,
        message: `Profile "${profileName}" requires plugin "${pluginName}" ${range}, but it has no version`,
      });
      continue;
    }
    if (satisfiesSemver(version, range)) {
      continue;
    }
    issues.push({
      code: 'incompatible-plugin-version',
      severity: 'error',
      profile: profileName,
      related: pluginName,
      message: `Profile "${profileName}" requires plugin "${pluginName}" ${range}, but it is ${version}`,
      details: { required: range, actual: version },
    });
  }

  return issues;
}

function collectPluginIssues(
  profiles: readonly ProjectProfile[],
  pluginsByName: Map<string, string>,
): ProfileIssue[] {
  const issues: ProfileIssue[] = [];
  for (const profile of profiles) {
    for (const pluginName of profile.requiredPlugins) {
      if (pluginsByName.has(pluginName)) {
        continue;
      }
      issues.push({
        code: 'missing-plugin',
        severity: 'error',
        profile: profile.name,
        related: pluginName,
        message: `Profile "${profile.name}" requires plugin "${pluginName}"`,
      });
    }
  }
  return issues;
}

function toProfileIssue(issue: CapabilityIssue): ProfileIssue {
  return {
    code: issue.code,
    severity: issue.severity,
    capability: issue.capability,
    related: issue.related,
    message: issue.message,
    details: issue.details,
  };
}

function compareProfileIssues(left: ProfileIssue, right: ProfileIssue): number {
  const code = compareCapabilityNames(left.code, right.code);
  if (code !== 0) {
    return code;
  }
  const profile = compareCapabilityNames(left.profile ?? '', right.profile ?? '');
  if (profile !== 0) {
    return profile;
  }
  const capability = compareCapabilityNames(left.capability ?? '', right.capability ?? '');
  if (capability !== 0) {
    return capability;
  }
  const related = compareCapabilityNames(left.related ?? '', right.related ?? '');
  if (related !== 0) {
    return related;
  }
  return compareCapabilityNames(left.message, right.message);
}

function issuePath(issue: ProfileIssue): string {
  if (issue.profile && issue.capability) {
    return `profiles.${issue.profile}.capabilities.${issue.capability}`;
  }
  if (issue.profile) {
    return `profiles.${issue.profile}`;
  }
  if (issue.capability) {
    return `capabilities.${issue.capability}`;
  }
  return 'profiles';
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
  return [...body.slice(minIndex), ...body.slice(0, minIndex), body[minIndex] ?? ''];
}
