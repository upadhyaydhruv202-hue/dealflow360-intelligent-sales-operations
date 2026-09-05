export { defineProfile } from './define';
export { PLATFORM_PROFILES, PROFILE_NAMES, listPlatformProfiles } from './catalog';
export { ProfileRegistry, createProfileRegistry, createPlatformProfileRegistry } from './registry';
export { PROFILE_ISSUE_CODES, assertProfileResolution, resolveProfiles } from './resolve';
export type {
  PluginVersionRef,
  ProfileIssue,
  ProfileIssueCode,
  ProfileIssueSeverity,
  ProfileResolution,
  ProfileVersionSnapshot,
  ResolveProfilesInput,
} from './resolve';
export { projectProfileSchema, versionCompatibilitySchema } from './schema';
export type {
  ProfileQuery,
  ProjectProfile,
  UnsupportedCombination,
  VersionCompatibility,
} from './types';
