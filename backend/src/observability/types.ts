export type MetricTags = Record<string, string>;

export interface MetricsSink {
  increment(name: string, value?: number, tags?: MetricTags): void;
  timing(name: string, durationMs: number, tags?: MetricTags): void;
  gauge?(name: string, value: number, tags?: MetricTags): void;
}

export interface ErrorContext {
  requestId?: string;
  jobId?: string;
  module?: string;
  extra?: Record<string, unknown>;
}

export interface ErrorTracker {
  captureException(error: unknown, context?: ErrorContext): void;
}

export interface Observability {
  metrics: MetricsSink;
  errors: ErrorTracker;
}

export const METRIC_NAMES = {
  HTTP_REQUESTS: 'http.requests',
  HTTP_ERRORS: 'http.errors',
  HTTP_LATENCY: 'http.latency',
  JOBS_ENQUEUED: 'jobs.enqueued',
  JOBS_STATUS: 'jobs.status',
  JOBS_LATENCY: 'jobs.latency',
  AI_CALLS: 'ai.calls',
  AI_LATENCY: 'ai.latency',
  NOTIFICATION_DELIVERY: 'notification.delivery',
} as const;
