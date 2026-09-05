import type { MetricsSink } from './types';
import { METRIC_NAMES } from './types';

export function recordAiCall(
  metrics: MetricsSink | null | undefined,
  input: {
    provider: string;
    operation: string;
    latencyMs: number;
    success: boolean;
  },
): void {
  if (!metrics) {
    return;
  }

  const tags = {
    provider: input.provider,
    operation: input.operation,
    success: input.success ? 'true' : 'false',
  };
  metrics.increment(METRIC_NAMES.AI_CALLS, 1, tags);
  metrics.timing(METRIC_NAMES.AI_LATENCY, input.latencyMs, {
    provider: input.provider,
    operation: input.operation,
  });
}

export function recordNotificationDelivery(
  metrics: MetricsSink | null | undefined,
  input: { channel: string; status: string },
): void {
  metrics?.increment(METRIC_NAMES.NOTIFICATION_DELIVERY, 1, {
    channel: input.channel,
    status: input.status,
  });
}

export function recordJobMetric(
  metrics: MetricsSink | null | undefined,
  input: { job: string; status: string; durationMs?: number },
): void {
  if (!metrics) {
    return;
  }

  metrics.increment(METRIC_NAMES.JOBS_STATUS, 1, { job: input.job, status: input.status });
  if (input.durationMs !== undefined) {
    metrics.timing(METRIC_NAMES.JOBS_LATENCY, input.durationMs, {
      job: input.job,
      status: input.status,
    });
  }
}
