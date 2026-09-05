import { createErrorTracker } from './errors';
import { createMetrics } from './metrics';
import type { ErrorTracker, MetricsSink, Observability } from './types';

export function createObservability(options: {
  metrics?: MetricsSink | null;
  errors?: ErrorTracker | null;
} = {}): Observability {
  return {
    metrics: createMetrics(options.metrics),
    errors: createErrorTracker(options.errors),
  };
}
