import type { PaginationMeta } from '@hackathon/api-contract';
import { API_PATHS } from '@hackathon/api-contract';

import { apiRequest } from './api';

export interface AnalyticsKpiSummary {
  name: string;
  summary?: string;
  unit?: string;
  aggregation: 'count' | 'sum' | 'avg' | 'min' | 'max';
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

export interface AnalyticsSnapshot {
  kpi: string;
  aggregation: string;
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

export interface AnalyticsQueryResponse {
  provider: 'postgres' | 'memory';
  kind: 'snapshot' | 'timeseries' | 'breakdown';
  kpi: string;
  aggregation: string;
  unit?: string;
  from: string;
  to: string;
  granularity?: string;
  groupBy?: string;
  snapshot?: AnalyticsSnapshot;
  points?: AnalyticsSeriesPoint[];
  rows?: AnalyticsBreakdownRow[];
  pagination: PaginationMeta;
}

export interface AnalyticsDashboardView {
  provider: string;
  dashboard: AnalyticsDashboardSummary & { title: string };
  from: string;
  to: string;
  widgets: Array<{
    id: string;
    type: 'kpi' | 'timeseries' | 'breakdown';
    title: string;
    kpi: string;
    result: AnalyticsQueryResponse;
  }>;
}

export interface AnalyticsExportResponse {
  provider: string;
  format: 'csv' | 'json';
  filename: string;
  contentType: string;
  content: string;
}

export function listAnalyticsKpis(token: string): Promise<{ provider: string; kpis: AnalyticsKpiSummary[] }> {
  return apiRequest(API_PATHS.analytics.kpis, { method: 'GET', token });
}

export function listAnalyticsDashboards(
  token: string,
): Promise<{ provider: string; dashboards: AnalyticsDashboardSummary[] }> {
  return apiRequest(API_PATHS.analytics.dashboards, { method: 'GET', token });
}

export function queryAnalytics(
  input: {
    kpi: string;
    kind?: 'snapshot' | 'timeseries' | 'breakdown';
    from?: string;
    to?: string;
    granularity?: 'hour' | 'day' | 'week' | 'month';
    groupBy?: string;
    filters?: Array<{ field: string; operator: string; value: unknown }>;
    page?: number;
    pageSize?: number;
  },
  token: string,
): Promise<AnalyticsQueryResponse> {
  return apiRequest<AnalyticsQueryResponse>(API_PATHS.analytics.query, {
    method: 'POST',
    token,
    body: input,
  });
}

export function evaluateAnalyticsDashboard(
  name: string,
  input: {
    from?: string;
    to?: string;
    granularity?: 'hour' | 'day' | 'week' | 'month';
    filters?: Array<{ field: string; operator: string; value: unknown }>;
  } = {},
  token: string,
): Promise<AnalyticsDashboardView> {
  return apiRequest<AnalyticsDashboardView>(API_PATHS.analytics.dashboardById(name), {
    method: 'POST',
    token,
    body: input,
  });
}

export function exportAnalytics(
  input: {
    kpi: string;
    kind?: 'snapshot' | 'timeseries' | 'breakdown';
    from?: string;
    to?: string;
    granularity?: 'hour' | 'day' | 'week' | 'month';
    groupBy?: string;
    filters?: Array<{ field: string; operator: string; value: unknown }>;
    format?: 'csv' | 'json';
  },
  token: string,
): Promise<AnalyticsExportResponse> {
  return apiRequest<AnalyticsExportResponse>(API_PATHS.analytics.export, {
    method: 'POST',
    token,
    body: input,
  });
}
