export { createAnalyticsService, AnalyticsService } from './analytics.service';
export type { AnalyticsServiceOptions } from './analytics.service';
export { resolveAnalyticsRuntimeConfig, isAnalyticsEnabled, resolveDefaultAnalyticsProvider } from './analytics.config';
export type { AnalyticsRuntimeConfig } from './analytics.config';
export {
  AnalyticsRegistry,
  createAnalyticsRegistry,
  DEMO_EVENTS_KPI,
  DEMO_VALUE_KPI,
  DEMO_ANALYTICS_DASHBOARD,
} from './analytics.registry';
export { createMemoryAnalyticsProvider, MemoryAnalyticsProvider } from './providers/memory.provider';
export { createPostgresAnalyticsProvider, PostgresAnalyticsProvider } from './providers/postgres.provider';
export { buildDemoAnalyticsFacts } from './analytics.demo';
export {
  analyticsQueryBodySchema,
  analyticsExportBodySchema,
  analyticsIngestBodySchema,
  analyticsDashboardParamsSchema,
  analyticsDashboardQuerySchema,
  analyticsKpiNameSchema,
} from './analytics.schemas';
export type {
  AnalyticsProvider,
  AnalyticsKpiDefinition,
  AnalyticsDashboardDefinition,
  AnalyticsQueryInput,
  AnalyticsQueryResult,
  AnalyticsFactInput,
  AnalyticsActor,
  AnalyticsExportResult,
  AnalyticsDashboardView,
} from './analytics.types';
