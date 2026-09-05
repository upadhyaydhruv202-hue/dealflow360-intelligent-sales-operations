import type { InjectionAssessment } from '../integrations/ai/guardrails';

export const UNKNOWN_VALUE = 'unknown' as const;
export type UnknownValue = typeof UNKNOWN_VALUE;

export const REQUIREMENT_CATEGORIES = [
  'summary',
  'user',
  'actor',
  'workflow',
  'entity',
  'business_rule',
  'integration',
  'odoo',
  'ai',
  'automation',
  'notification',
  'document',
  'report',
  'security',
  'non_functional',
  'data',
  'infrastructure',
] as const;

export type RequirementCategory = (typeof REQUIREMENT_CATEGORIES)[number];

export const REQUIREMENT_CLASSIFICATIONS = [
  'existing_capability',
  'new_problem_logic',
  'both',
  'unknown',
] as const;

export type RequirementClassification = (typeof REQUIREMENT_CLASSIFICATIONS)[number];

export const ACTOR_KINDS = ['human', 'system', 'unknown'] as const;
export type ActorKind = (typeof ACTOR_KINDS)[number];

export const ODOO_OPERATIONS = ['read', 'write', 'unknown'] as const;
export type OdooOperation = (typeof ODOO_OPERATIONS)[number];

export type Unknownable<T> = T | UnknownValue;

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
  kind: ActorKind;
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
  operation: OdooOperation;
  notes: Unknownable<string>;
}

export interface RequirementMappingDraft {
  requirement: string;
  category: RequirementCategory;
  existingCapability: Unknownable<string>;
  newProblemLogic: Unknownable<string>;
  confidence: number;
  evidence?: string;
}

export interface ProblemIntelligenceDraft {
  problemSummary: Unknownable<string>;
  users: Unknownable<NamedItem[]>;
  actors: Unknownable<ActorItem[]>;
  workflows: Unknownable<WorkflowItem[]>;
  entities: Unknownable<EntityItem[]>;
  businessRules: Unknownable<NamedItem[]>;
  integrations: Unknownable<NamedItem[]>;
  odooRequirements: Unknownable<OdooRequirementItem[]>;
  aiRequirements: Unknownable<NamedItem[]>;
  automationRequirements: Unknownable<NamedItem[]>;
  notifications: Unknownable<NamedItem[]>;
  documents: Unknownable<NamedItem[]>;
  reports: Unknownable<NamedItem[]>;
  securityRequirements: Unknownable<NamedItem[]>;
  nonFunctionalRequirements: Unknownable<NamedItem[]>;
  likelyDataRequirements: Unknownable<NamedItem[]>;
  likelyInfrastructureRequirements: Unknownable<NamedItem[]>;
  mappings: RequirementMappingDraft[];
  confidence: number;
  uncertainty: string[];
  unknowns: string[];
  requiresReview: boolean;
}

export interface ClassifiedMapping {
  requirement: string;
  category: RequirementCategory;
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

export interface ProblemIntelligenceAnalyzeInput {
  statement: string;
  title?: string;
  userId?: string;
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
  injection: InjectionAssessment;
  catalogVersion: string;
  promptVersion: string;
  model: string;
  provider: string;
}
