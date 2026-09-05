import type { CapabilityResolution } from '../capabilities';
import type {
  ClassifiedMapping,
  ProblemIntelligenceSpec,
  RequirementMappingDraft,
} from '../problem-intelligence';

export const RECOMMENDATION_KINDS = [
  'capability',
  'profile',
  'adapter',
  'infrastructure',
  'architecture-mode',
  'deployment-mode',
] as const;

export type RecommendationKind = (typeof RECOMMENDATION_KINDS)[number];

export const RECOMMENDATION_STATUSES = ['recommended', 'baseline', 'not_recommended'] as const;
export type RecommendationStatus = (typeof RECOMMENDATION_STATUSES)[number];

export const IMPACT_LEVELS = ['none', 'low', 'medium', 'high'] as const;
export type ImpactLevel = (typeof IMPACT_LEVELS)[number];

export const OUT_OF_CATALOG = {
  elasticsearch: 'elasticsearch',
  kafka: 'kafka',
  pgvector: 'pgvector',
  clickhouse: 'clickhouse',
  bigquery: 'bigquery',
  snowflake: 'snowflake',
} as const;

export type OutOfCatalogName = (typeof OUT_OF_CATALOG)[keyof typeof OUT_OF_CATALOG];

export interface RecommendationAlternative {
  name: string;
  reason: string;
}

export interface DependencyImpact {
  adds: string[];
  optional: string[];
  missingIfSelected: string[];
}

export interface RecommendationItem {
  id: string;
  kind: RecommendationKind;
  status: RecommendationStatus;
  requirementSatisfied: string;
  capabilitySelected: string;
  reason: string;
  dependencyImpact: DependencyImpact;
  complexityImpact: ImpactLevel;
  securityImpact: ImpactLevel;
  confidence: number;
  alternative: RecommendationAlternative;
  /** Always true. The engine never applies the selection. */
  advisory: true;
}

export interface SuggestedFeatureFlag {
  name: string;
  suggested: boolean;
  reason: string;
  capability: string;
}

export interface CapabilityRecommendationSelected {
  capabilities: string[];
  profiles: string[];
  adapters: string[];
  infrastructure: string[];
  architectureMode: string;
  deploymentMode: string;
}

export interface CapabilityRecommendationInput {
  spec?: Partial<ProblemIntelligenceSpec> | null;
  mappings?: Array<ClassifiedMapping | RequirementMappingDraft>;
  existingCapabilities?: Array<{ name: string; summary?: string; requirements?: string[] }>;
  newProblemLogic?: Array<{ requirement: string; logic: string }>;
  unknowns?: string[];
  uncertainty?: string[];
  problemSummary?: string;
}

export interface CapabilityRecommendationResult {
  advisory: true;
  humanSelectionAuthoritative: true;
  enabledNothing: true;
  architectureMode: RecommendationItem;
  deploymentMode: RecommendationItem;
  profiles: RecommendationItem[];
  capabilities: RecommendationItem[];
  adapters: RecommendationItem[];
  infrastructure: RecommendationItem[];
  rejected: RecommendationItem[];
  selected: CapabilityRecommendationSelected;
  featureFlags: SuggestedFeatureFlag[];
  resolution: Pick<CapabilityResolution, 'valid' | 'selected' | 'ordered' | 'required' | 'missing' | 'optionalMissing'> & {
    issueCount: number;
  };
  notes: string[];
  unknowns: string[];
  confidence: number;
  catalogVersion: string;
}

export interface CapabilityRecommendRequest {
  analysis: CapabilityRecommendationInput;
  title?: string;
  userId?: string;
}
