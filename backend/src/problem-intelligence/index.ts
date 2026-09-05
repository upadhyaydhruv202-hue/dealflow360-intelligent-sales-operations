export {
  createProblemIntelligenceService,
  isProblemIntelligenceEnabled,
  ProblemIntelligenceService,
} from './service';
export type { ProblemIntelligenceServiceOptions } from './service';
export {
  problemIntelligenceAnalyzeBodySchema,
  problemIntelligenceDraftSchema,
} from './schemas';
export type { ProblemIntelligenceAnalyzeBody } from './schemas';
export { buildProblemIntelligencePrompt, PROBLEM_INTELLIGENCE_PROMPT_ID } from './prompt';
export {
  classifyMappings,
  collectExistingCapabilities,
  collectNewProblemLogic,
  isUnknown,
  resolveCatalogCapability,
  toUnknownableList,
} from './classify';
export { CAPABILITY_ALIASES, normalizeCapabilityRef } from './aliases';
export { buildProblemIntelligenceDraft } from './fixtures';
export {
  ACTOR_KINDS,
  ODOO_OPERATIONS,
  REQUIREMENT_CATEGORIES,
  REQUIREMENT_CLASSIFICATIONS,
  UNKNOWN_VALUE,
} from './types';
export type {
  ActorItem,
  ClassifiedMapping,
  EntityItem,
  NamedItem,
  OdooRequirementItem,
  ProblemIntelligenceAnalyzeInput,
  ProblemIntelligenceDraft,
  ProblemIntelligenceResult,
  ProblemIntelligenceSpec,
  RequirementCategory,
  RequirementClassification,
  RequirementMappingDraft,
  Unknownable,
  UnknownableList,
  WorkflowItem,
} from './types';
