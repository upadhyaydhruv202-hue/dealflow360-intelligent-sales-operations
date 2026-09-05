export const CAPABILITY_KINDS = [
  'application',
  'infrastructure',
  'adapter',
  'architecture-mode',
  'deployment-mode',
] as const;

export type CapabilityKind = (typeof CAPABILITY_KINDS)[number];

export const CAPABILITY_MATURITIES = [
  'experimental',
  'beta',
  'stable',
  'enterprise',
  'deprecated',
] as const;

export type CapabilityMaturity = (typeof CAPABILITY_MATURITIES)[number];

export const CAPABILITY_CATEGORIES = [
  'core',
  'integration',
  'ai',
  'automation',
  'frontend',
  'infrastructure',
  'adapter',
  'architecture',
  'deployment',
] as const;

export type CapabilityCategory = (typeof CAPABILITY_CATEGORIES)[number];

export const DEFAULT_ARCHITECTURE_MODE = 'architecture.modular-monolith';

export const DEFAULT_DEPLOYMENT_MODES = [
  'deployment.local-hybrid',
  'deployment.docker-compose',
] as const;

/**
 * Machine-readable platform capability. This is catalog metadata.
 * It is not an Odoo allowlist entry, copilot tool, intent, or FEATURE_* flag.
 */
export interface CapabilityDefinition {
  name: string;
  version: string;
  kind: CapabilityKind;
  category: CapabilityCategory;
  maturity: CapabilityMaturity;
  summary: string;
  dependencies: readonly string[];
  optionalDependencies: readonly string[];
  conflicts: readonly string[];
  environmentRequirements: readonly string[];
  infrastructureRequirements: readonly string[];
  providerRequirements: readonly string[];
  permissions: readonly string[];
  architectureCompatibility: readonly string[];
  deploymentCompatibility: readonly string[];
  frontendAvailability: boolean;
  backendAvailability: boolean;
  workerRequirement: boolean;
  databaseRequirement: boolean;
  tests: readonly string[];
  documentation: readonly string[];
  /** Maps to FEATURE_REGISTRY when this capability is env-gated. Not a second flag system. */
  featureFlag?: string;
  /** When there is no feature flag, whether discovery treats the capability as on. */
  defaultEnabled?: boolean;
}

export interface DiscoveredCapability extends CapabilityDefinition {
  enabled: boolean;
}

export interface CapabilityContributor {
  name: string;
  capabilities?: readonly CapabilityDefinition[];
}

export interface DiscoverCapabilitiesOptions {
  config?: CapabilityEnablementConfig;
  plugins?: readonly CapabilityContributor[];
  extras?: readonly CapabilityDefinition[];
  includeDisabled?: boolean;
}

export interface CapabilityEnablementConfig {
  demoMode?: boolean;
  databaseUrl?: string;
  redisUrl?: string;
  features?: Record<string, boolean>;
  ai?: { provider?: string };
  email?: { provider?: string; enabled?: boolean };
  sms?: { provider?: string; enabled?: boolean };
  storage?: { provider?: string };
  otp?: { provider?: string; enabled?: boolean };
  rag?: { vectorStore?: string };
  search?: { provider?: string };
  analytics?: { provider?: string };
}

export interface CapabilityQuery {
  kind?: CapabilityKind;
  category?: CapabilityCategory;
  maturity?: CapabilityMaturity;
  enabled?: boolean;
  name?: string;
}
