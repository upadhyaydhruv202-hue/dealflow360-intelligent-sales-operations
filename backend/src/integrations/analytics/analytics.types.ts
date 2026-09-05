import type { PaginationMeta } from '@hackathon/api-contract';

import type {
  AnalyticsAggregation,
  AnalyticsExportFormat,
  AnalyticsGranularity,
  AnalyticsProviderName,
  AnalyticsQueryKind,
  AnalyticsWidgetType,
} from '../../constants';

export type {
  AnalyticsAggregation,
  AnalyticsExportFormat,
  AnalyticsGranularity,
  AnalyticsProviderName,
  AnalyticsQueryKind,
  AnalyticsWidgetType,
};

/**
 * Implemented providers are postgres (default) and memory (tests).
 * A future warehouse adapter must implement {@link AnalyticsProvider} only.
 * Application services must depend on AnalyticsService, never on a vendor client.
 */
export const ANALYTICS_PROVIDER_NAMES = ['postgres', 'memory'] as const;

export type AnalyticsDimensionValue = string | number | boolean | null;

export interface AnalyticsDimensionField {
  type: 'keyword' | 'number' | 'boolean';
  filterable?: boolean;
  groupable?: boolean;
}

export interface AnalyticsKpiDefinition {
  name: string;
  summary?: string;
  unit?: string;
  aggregation: AnalyticsAggregation;
  permission: string;
  writePermission?: string;
  exportPermission?: string;
  ownerScoped?: boolean;
  httpWritable?: boolean;
  dimensions: Record<string, AnalyticsDimensionField>;
}

export interface AnalyticsWidgetDefinition {
  id: string;
  type: AnalyticsWidgetType;
  kpi: string;
  title?: string;
  groupBy?: string;
  granularity?: AnalyticsGranularity;
}

export interface AnalyticsDashboardDefinition {
  name: string;
  title: string;
  summary?: string;
  permission: string;
  widgets: readonly AnalyticsWidgetDefinition[];
}

export interface AnalyticsKpiSummary {
  name: string;
  summary?: string;
  unit?: string;
  aggregation: AnalyticsAggregation;
  ownerScoped: boolean;
  httpWritable: boolean;
  filterableFields: string[];
  groupableFields: string[];
}

export interface AnalyticsDashboardSummary {
  name: string;
  title: string;
  summary?: string;
  widgets: number;
}

export interface AnalyticsActor {
  id: string;
  permissions: readonly string[];
}

export interface AnalyticsFilter {
  field: string;
  operator: 'eq' | 'neq' | 'in' | 'gte' | 'lte';
  value: unknown;
}

export interface AnalyticsFactInput {
  kpi: string;
  occurredAt: Date | string;
  value?: number;
  dimensions?: Record<string, AnalyticsDimensionValue>;
  eventId?: string;
  ownerId?: string | null;
  source?: string;
}

export interface StoredAnalyticsFact {
  id: string;
  kpiKey: string;
  source: string;
  eventId: string;
  occurredAt: Date;
  ownerId: string | null;
  value: number;
  dimensions: Record<string, AnalyticsDimensionValue>;
}

export interface AnalyticsQueryInput {
  kpi: string;
  kind?: AnalyticsQueryKind;
  from?: Date | string;
  to?: Date | string;
  granularity?: AnalyticsGranularity;
  groupBy?: string;
  filters?: AnalyticsFilter[];
  page?: number;
  pageSize?: number;
  /** Internal limit that may exceed HTTP pageSize (dashboards / exports). */
  take?: number;
  actor: AnalyticsActor;
}

export interface AnalyticsExportInput extends AnalyticsQueryInput {
  format?: AnalyticsExportFormat;
}

export interface AnalyticsSnapshot {
  kpi: string;
  aggregation: AnalyticsAggregation;
  unit?: string;
  from: string;
  to: string;
  value: number;
  samples: number;
}

export interface AnalyticsSeriesPoint {
  bucket: string;
  value: number;
  samples: number;
}

export interface AnalyticsBreakdownRow {
  key: string;
  value: number;
  samples: number;
}

export interface AnalyticsQueryResult {
  provider: AnalyticsProviderName;
  kind: AnalyticsQueryKind;
  kpi: string;
  aggregation: AnalyticsAggregation;
  unit?: string;
  from: string;
  to: string;
  granularity?: AnalyticsGranularity;
  groupBy?: string;
  snapshot?: AnalyticsSnapshot;
  points?: AnalyticsSeriesPoint[];
  rows?: AnalyticsBreakdownRow[];
  meta: PaginationMeta;
}

export interface AnalyticsExportResult {
  provider: AnalyticsProviderName;
  format: AnalyticsExportFormat;
  filename: string;
  contentType: string;
  content: string;
  query: AnalyticsQueryResult;
}

export interface AnalyticsDashboardView {
  provider: AnalyticsProviderName;
  dashboard: AnalyticsDashboardSummary & { title: string };
  from: string;
  to: string;
  widgets: Array<{
    id: string;
    type: AnalyticsWidgetType;
    title: string;
    kpi: string;
    result: AnalyticsQueryResult;
  }>;
}

export interface ProviderAnalyticsWindow {
  kpiKey: string;
  from: Date;
  to: Date;
  ownerId: string | null;
  ownerScoped: boolean;
  filters: readonly AnalyticsFilter[];
  aggregation: AnalyticsAggregation;
}

export interface ProviderTimeseriesQuery extends ProviderAnalyticsWindow {
  granularity: AnalyticsGranularity;
  skip: number;
  take: number;
}

export interface ProviderBreakdownQuery extends ProviderAnalyticsWindow {
  groupBy: string;
  skip: number;
  take: number;
}

export interface ProviderSnapshotResult {
  value: number;
  samples: number;
}

export interface ProviderTimeseriesResult {
  points: AnalyticsSeriesPoint[];
  totalItems: number;
}

export interface ProviderBreakdownResult {
  rows: AnalyticsBreakdownRow[];
  totalItems: number;
}

export interface AnalyticsProvider {
  readonly name: AnalyticsProviderName;
  ingest(facts: readonly StoredAnalyticsFact[]): Promise<number>;
  snapshot(query: ProviderAnalyticsWindow): Promise<ProviderSnapshotResult>;
  timeseries(query: ProviderTimeseriesQuery): Promise<ProviderTimeseriesResult>;
  breakdown(query: ProviderBreakdownQuery): Promise<ProviderBreakdownResult>;
}
