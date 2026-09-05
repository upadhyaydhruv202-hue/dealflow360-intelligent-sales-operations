export {
  PLATFORM_VERSION,
  CAPABILITY_VERSION,
  PROFILE_VERSION,
  PLUGIN_VERSION,
  SEMVER_PATTERN,
  CAPABILITY_VERSION_PATTERN,
  isValidSemver,
  isValidCapabilityVersion,
  isValidProfileVersion,
  isValidPluginVersion,
  isValidPlatformVersion,
  assertSemver,
  assertCapabilityVersion,
  assertProfileVersion,
  assertPluginVersion,
  assertPlatformVersion,
} from './version';
export { compareSemver, parseSemver, satisfiesSemver } from './semver';
export {
  CAPABILITY_KINDS,
  CAPABILITY_MATURITIES,
  CAPABILITY_CATEGORIES,
  DEFAULT_ARCHITECTURE_MODE,
  DEFAULT_DEPLOYMENT_MODES,
} from './types';
export type {
  CapabilityKind,
  CapabilityMaturity,
  CapabilityCategory,
  CapabilityDefinition,
  DiscoveredCapability,
  CapabilityContributor,
  DiscoverCapabilitiesOptions,
  CapabilityEnablementConfig,
  CapabilityQuery,
} from './types';
export {
  capabilityDefinitionSchema,
  capabilityNameSchema,
  capabilityVersionSchema,
} from './schema';
export { CapabilityRegistry, createCapabilityRegistry } from './registry';
export { isCapabilityEnabled } from './evaluate';
export { PLATFORM_CAPABILITIES, listPlatformCapabilities } from './catalog';
export {
  createPlatformCapabilityRegistry,
  discoverCapabilities,
  registerContributorCapabilities,
  snapshotCapabilities,
} from './discover';
export { defineCapability } from './catalog/define';
export {
  CAPABILITY_EDGE_KINDS,
  buildCapabilityGraph,
  compareCapabilityNames,
  findCircularDependencies,
  requiredClosure,
  topologicalOrder,
  uniqueSortedNames,
} from './graph';
export type {
  CapabilityEdgeKind,
  CapabilityGraph,
  CapabilityGraphEdge,
  CapabilityGraphNode,
} from './graph';
export { CAPABILITY_ISSUE_CODES, assertCapabilityResolution, resolveCapabilities } from './resolve';
export type {
  CapabilityIssue,
  CapabilityIssueCode,
  CapabilityIssueSeverity,
  CapabilityResolution,
  CapabilityResolveRequest,
  ResolveCapabilitiesInput,
} from './resolve';
export {
  PLATFORM_PROFILES,
  PROFILE_NAMES,
  PROFILE_ISSUE_CODES,
  ProfileRegistry,
  assertProfileResolution,
  createPlatformProfileRegistry,
  createProfileRegistry,
  defineProfile,
  listPlatformProfiles,
  resolveProfiles,
} from './profiles';
export type {
  PluginVersionRef,
  ProfileIssue,
  ProfileIssueCode,
  ProfileIssueSeverity,
  ProfileQuery,
  ProfileResolution,
  ProfileVersionSnapshot,
  ProjectProfile,
  ResolveProfilesInput,
  UnsupportedCombination,
  VersionCompatibility,
} from './profiles';
