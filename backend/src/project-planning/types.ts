import type { CapabilityIssue, CapabilityIssueCode } from '../capabilities';
import type { ProfileIssue, ProfileIssueCode } from '../capabilities';
import type {
  CapabilityRecommendationInput,
  CapabilityRecommendationResult,
  DependencyImpact,
  RecommendationAlternative,
} from '../capability-recommendations/types';

export const PROJECT_CONFIGURATION_SCHEMA_VERSION = 1 as const;

export const PROJECT_CONFIGURATION_STATUSES = ['draft', 'invalid', 'approved'] as const;
export type ProjectConfigurationStatus = (typeof PROJECT_CONFIGURATION_STATUSES)[number];

export const UNIMPLEMENTED_MODES = [
  'architecture.microservices',
  'deployment.kubernetes',
] as const;

export type UnimplementedMode = (typeof UNIMPLEMENTED_MODES)[number];

export const PLANNING_ISSUE_CODES = [
  'unknown-capability',
  'missing-dependency',
  'circular-dependency',
  'conflict',
  'unsupported-architecture-mode',
  'unsupported-deployment-mode',
  'missing-environment-variable',
  'missing-infrastructure',
  'unavailable-provider',
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
  'unimplemented-mode',
  'unknown-feature-flag',
  'mode-in-capability-list',
  'empty-selection',
] as const;

export type PlanningIssueCode = (typeof PLANNING_ISSUE_CODES)[number];

export type PlanningIssueSeverity = 'error' | 'warning';

export interface PlanningIssue {
  code: PlanningIssueCode;
  severity: PlanningIssueSeverity;
  message: string;
  capability?: string;
  profile?: string;
  related?: string;
  details?: Record<string, unknown>;
}

export interface ProjectRequirement {
  id: string;
  requirement: string;
  category: string | null;
  classification: string | null;
  existingCapability: string | null;
  newProblemLogic: string | null;
  source: 'analysis' | 'human';
}

export interface ProjectCapabilityReason {
  capability: string;
  requirementSatisfied: string;
  reason: string;
  source: 'recommendation' | 'human' | 'profile' | 'dependency-closure';
  confidence: number;
  alternative: RecommendationAlternative;
  dependencyImpact: DependencyImpact;
}

export interface ProjectDependency {
  capability: string;
  requires: string[];
  optional: string[];
  missing: string[];
}

export interface ProjectConflict {
  capability: string;
  conflictsWith: string;
  bothSelected: boolean;
}

export interface FeatureAvailabilityItem {
  capability: string;
  featureFlag: string;
  envVar: string | null;
  known: boolean;
  currentlyEnabled: boolean;
  requiredBySelection: true;
}

export interface ProjectProposedSelection {
  capabilities: string[];
  profiles: string[];
  architectureMode: string;
  deploymentMode: string;
  includeOptional: boolean;
  closeDependencies: boolean;
}

export interface ProjectResolvedSelection {
  capabilities: string[];
  ordered: string[];
  profiles: string[];
  adapters: string[];
  infrastructure: string[];
  architectureMode: string;
  deploymentMode: string;
  required: string[];
  missing: string[];
  optionalMissing: string[];
}

export interface ProjectValidation {
  valid: boolean;
  permissionsOk: true;
  capabilityExistence: { unknown: string[] };
  missingDependencies: string[];
  conflicts: Array<{ a: string; b: string }>;
  compatibility: {
    architectureMode: string;
    deploymentMode: string;
    issues: PlanningIssue[];
  };
  featureAvailability: FeatureAvailabilityItem[];
  unimplementedModes: string[];
  issues: PlanningIssue[];
}

export interface ProjectGenerationGuard {
  allowed: false;
  attempted: false;
  note: string;
}

export interface ProjectConfiguration {
  schemaVersion: typeof PROJECT_CONFIGURATION_SCHEMA_VERSION;
  id: string;
  status: ProjectConfigurationStatus;
  approved: boolean;
  generatedNothing: true;
  humanSelectionAuthoritative: true;
  catalogVersion: string;
  platformVersion: string;
  title: string | null;
  problemSummary: string | null;
  requirements: ProjectRequirement[];
  proposed: ProjectProposedSelection;
  resolved: ProjectResolvedSelection;
  reasons: ProjectCapabilityReason[];
  dependencies: ProjectDependency[];
  conflicts: ProjectConflict[];
  validation: ProjectValidation;
  featureFlags: Array<{ name: string; suggested: boolean; reason: string; capability: string }>;
  notes: string[];
  generation: ProjectGenerationGuard;
  integrity: {
    algorithm: 'sha256';
    digest: string;
  };
  approvedAt: string | null;
  approvedBy: string | null;
}

export interface ProjectPlanningSelectionInput {
  title?: string;
  statement?: string;
  analysis?: CapabilityRecommendationInput | null;
  capabilities?: readonly string[];
  profiles?: readonly string[];
  architectureMode?: string;
  deploymentMode?: string;
  includeOptional?: boolean;
  closeDependencies?: boolean;
}

export interface BuildProjectConfigurationOptions {
  intent: 'validate' | 'approve';
  userId?: string;
  now?: () => Date;
  id?: () => string;
  recommendations?: CapabilityRecommendationResult | null;
  featureConfig?: { features: Record<string, boolean> };
}

export interface ProjectPlanningAnalyzeResult {
  analysis: unknown | null;
  recommendations: CapabilityRecommendationResult;
  configuration: ProjectConfiguration;
}

export type { CapabilityIssue, CapabilityIssueCode, ProfileIssue, ProfileIssueCode };
