import type { CapabilityMaturity } from '../types';

export interface VersionCompatibility {
  /** Semver range the platform version must satisfy. */
  platform?: string;
  /** Per-capability version ranges, checked when that capability is composed. */
  capabilities?: Readonly<Record<string, string>>;
  /** Per-included-profile version ranges, checked while expanding `includes`. */
  profiles?: Readonly<Record<string, string>>;
  /** Per-plugin version ranges, checked when that plugin is present. */
  plugins?: Readonly<Record<string, string>>;
}

export interface UnsupportedCombination {
  profiles?: readonly string[];
  capabilities?: readonly string[];
  architectureModes?: readonly string[];
  deploymentModes?: readonly string[];
  message: string;
}

/**
 * Named, composable set of capabilities. Profiles do not contain business logic.
 * They are optional: a problem may select capabilities directly.
 */
export interface ProjectProfile {
  name: string;
  title: string;
  version: string;
  maturity: CapabilityMaturity;
  summary: string;
  /** Other profiles whose capabilities are inherited. */
  includes: readonly string[];
  /** Capability names this profile selects. Not auto-closed. */
  capabilities: readonly string[];
  /** Suggested extras. Included only when `includeOptional` is true. */
  optionalCapabilities: readonly string[];
  /** Capability names this profile refuses to compose with. */
  conflicts: readonly string[];
  /** Profile names that cannot be selected together with this one. */
  conflictingProfiles: readonly string[];
  architectureCompatibility: readonly string[];
  deploymentCompatibility: readonly string[];
  compatibility: VersionCompatibility;
  incompatibleWith: readonly UnsupportedCombination[];
  requiredPlugins: readonly string[];
  tests: readonly string[];
  documentation: readonly string[];
}

export interface ProfileQuery {
  name?: string;
  maturity?: CapabilityMaturity;
}
