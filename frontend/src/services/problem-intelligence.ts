import { API_PATHS } from '@hackathon/api-contract';

import { apiRequest } from './api';

export type RequirementClassification =
  | 'existing_capability'
  | 'new_problem_logic'
  | 'both'
  | 'unknown';

export type Unknownable<T> = T | 'unknown';

export interface UnknownableList<T> {
  determined: boolean;
  items: T[];
}

export interface NamedItem {
  name: string;
  description: Unknownable<string>;
  confidence?: number;
}

export interface ActorItem {
  name: Unknownable<string>;
  kind: 'human' | 'system' | 'unknown';
  description: Unknownable<string>;
}

export interface WorkflowItem {
  name: Unknownable<string>;
  steps: Unknownable<string[]>;
  actors: Unknownable<string[]>;
}

export interface EntityItem {
  name: Unknownable<string>;
  fields: Unknownable<string[]>;
  description: Unknownable<string>;
}

export interface OdooRequirementItem {
  app: Unknownable<string>;
  model: Unknownable<string>;
  operation: 'read' | 'write' | 'unknown';
  notes: Unknownable<string>;
}

export interface ClassifiedMapping {
  requirement: string;
  category: string;
  classification: RequirementClassification;
  existingCapability: { name: string; summary: string; maturity: string } | null;
  newProblemLogic: string | null;
  hallucinatedCapability: string | null;
  confidence: number;
  evidence?: string;
}

export interface ProblemIntelligenceSpec {
  problemSummary: Unknownable<string>;
  users: UnknownableList<NamedItem>;
  actors: UnknownableList<ActorItem>;
  workflows: UnknownableList<WorkflowItem>;
  entities: UnknownableList<EntityItem>;
  businessRules: UnknownableList<NamedItem>;
  integrations: UnknownableList<NamedItem>;
  odooRequirements: UnknownableList<OdooRequirementItem>;
  aiRequirements: UnknownableList<NamedItem>;
  automationRequirements: UnknownableList<NamedItem>;
  notifications: UnknownableList<NamedItem>;
  documents: UnknownableList<NamedItem>;
  reports: UnknownableList<NamedItem>;
  securityRequirements: UnknownableList<NamedItem>;
  nonFunctionalRequirements: UnknownableList<NamedItem>;
  likelyDataRequirements: UnknownableList<NamedItem>;
  likelyInfrastructureRequirements: UnknownableList<NamedItem>;
}

export interface ProblemIntelligenceResult {
  title: string | null;
  spec: ProblemIntelligenceSpec;
  mappings: ClassifiedMapping[];
  existingCapabilities: Array<{ name: string; summary: string; requirements: string[] }>;
  newProblemLogic: Array<{ requirement: string; logic: string }>;
  unknowns: string[];
  uncertainty: string[];
  confidence: number;
  requiresReview: boolean;
  injection: { suspicious: boolean; signals: string[] };
  catalogVersion: string;
  promptVersion: string;
  model: string;
  provider: string;
}

export function analyzeProblemStatement(
  input: { statement: string; title?: string },
  token: string,
): Promise<ProblemIntelligenceResult> {
  return apiRequest<ProblemIntelligenceResult>(API_PATHS.problemIntelligence.analyze, {
    method: 'POST',
    token,
    body: input,
  });
}
