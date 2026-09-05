import { API_PATHS } from '@hackathon/api-contract';

import { apiRequest } from './api';

export type ImpactLevel = 'none' | 'low' | 'medium' | 'high';
export type RecommendationKind =
  | 'capability'
  | 'profile'
  | 'adapter'
  | 'infrastructure'
  | 'architecture-mode'
  | 'deployment-mode';
export type RecommendationStatus = 'recommended' | 'baseline' | 'not_recommended';

export interface RecommendationItem {
  id: string;
  kind: RecommendationKind;
  status: RecommendationStatus;
  requirementSatisfied: string;
  capabilitySelected: string;
  reason: string;
  dependencyImpact: { adds: string[]; optional: string[]; missingIfSelected: string[] };
  complexityImpact: ImpactLevel;
  securityImpact: ImpactLevel;
  confidence: number;
  alternative: { name: string; reason: string };
  advisory: true;
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
  selected: {
    capabilities: string[];
    profiles: string[];
    adapters: string[];
    infrastructure: string[];
    architectureMode: string;
    deploymentMode: string;
  };
  featureFlags: Array<{ name: string; suggested: boolean; reason: string; capability: string }>;
  resolution: {
    valid: boolean;
    selected: string[];
    ordered: string[];
    required: string[];
    missing: string[];
    optionalMissing: string[];
    issueCount: number;
  };
  notes: string[];
  unknowns: string[];
  confidence: number;
  catalogVersion: string;
}

export function recommendCapabilities(
  input: { analysis: unknown; title?: string },
  token: string,
): Promise<CapabilityRecommendationResult> {
  return apiRequest<CapabilityRecommendationResult>(API_PATHS.capabilityRecommendations.recommend, {
    method: 'POST',
    token,
    body: input,
  });
}
