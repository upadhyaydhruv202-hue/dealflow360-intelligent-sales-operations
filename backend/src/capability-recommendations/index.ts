export { recommendCapabilities } from './engine';
export type { RecommendCapabilitiesOptions } from './engine';
export {
  createCapabilityRecommendationService,
  isCapabilityRecommendationsEnabled,
  CapabilityRecommendationService,
} from './service';
export type { CapabilityRecommendationServiceOptions } from './service';
export { capabilityRecommendBodySchema, capabilityRecommendationAnalysisSchema } from './schemas';
export type { CapabilityRecommendBody } from './schemas';
export {
  analysisBackgroundJobs,
  analysisDefaultArchitecture,
  analysisEventStreaming,
  analysisLargeScaleSearch,
  analysisMicroservicesAndK8s,
  analysisOdooAndAi,
  analysisSemanticSearch,
  analysisSimpleSearch,
} from './fixtures';
export { detectSignals, buildCorpus } from './signals';
export { OUT_OF_CATALOG, RECOMMENDATION_KINDS, IMPACT_LEVELS } from './types';
export type {
  CapabilityRecommendRequest,
  CapabilityRecommendationInput,
  CapabilityRecommendationResult,
  DependencyImpact,
  RecommendationAlternative,
  RecommendationItem,
  RecommendationKind,
  RecommendationStatus,
  SuggestedFeatureFlag,
} from './types';
