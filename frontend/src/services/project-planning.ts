import { API_PATHS } from '@hackathon/api-contract';

import { apiRequest } from './api';
import type { CapabilityRecommendationResult } from './capability-recommendations';

export type ProjectConfigurationStatus = 'draft' | 'invalid' | 'approved';

export interface PlanningIssue {
  code: string;
  severity: 'error' | 'warning';
  message: string;
  capability?: string;
  profile?: string;
  related?: string;
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
  alternative: { name: string; reason: string };
  dependencyImpact: { adds: string[]; optional: string[]; missingIfSelected: string[] };
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

export interface ProjectConfiguration {
  schemaVersion: 1;
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
  proposed: {
    capabilities: string[];
    profiles: string[];
    architectureMode: string;
    deploymentMode: string;
    includeOptional: boolean;
    closeDependencies: boolean;
  };
  resolved: {
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
  };
  reasons: ProjectCapabilityReason[];
  dependencies: ProjectDependency[];
  conflicts: ProjectConflict[];
  validation: {
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
  };
  featureFlags: Array<{ name: string; suggested: boolean; reason: string; capability: string }>;
  notes: string[];
  generation: { allowed: false; attempted: false; note: string };
  integrity: { algorithm: 'sha256'; digest: string };
  approvedAt: string | null;
  approvedBy: string | null;
}

export interface ProjectPlanningAnalyzeResult {
  analysis: unknown | null;
  recommendations: CapabilityRecommendationResult;
  configuration: ProjectConfiguration;
}

export interface ProjectPlanningSelection {
  title?: string;
  statement?: string;
  analysis?: unknown;
  capabilities: string[];
  profiles: string[];
  architectureMode: string;
  deploymentMode: string;
  includeOptional?: boolean;
  closeDependencies?: boolean;
}

export const PROJECT_CONFIGURATION_STORAGE_KEY = 'hsk.project-configuration';

export function analyzeProjectPlanning(
  input: { statement: string; title?: string },
  token: string,
): Promise<ProjectPlanningAnalyzeResult> {
  return apiRequest<ProjectPlanningAnalyzeResult>(API_PATHS.projectPlanning.analyze, {
    method: 'POST',
    token,
    body: input,
  });
}

export function validateProjectPlanning(
  input: ProjectPlanningSelection,
  token: string,
): Promise<ProjectConfiguration> {
  return apiRequest<ProjectConfiguration>(API_PATHS.projectPlanning.validate, {
    method: 'POST',
    token,
    body: input,
  });
}

export function approveProjectPlanning(
  input: ProjectPlanningSelection,
  token: string,
): Promise<ProjectConfiguration> {
  return apiRequest<ProjectConfiguration>(API_PATHS.projectPlanning.approve, {
    method: 'POST',
    token,
    body: input,
  });
}
