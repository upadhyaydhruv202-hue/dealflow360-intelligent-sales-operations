import { TimeoutError } from '../errors';
import { sanitizeErrorMessage } from '../errors/sanitize';
import { runWithJobContext } from '../utils/request-context';
import { isRetryableJobError } from './retry';
import { clampProgress, jobErrorMessage } from './status';
import { withTimeout } from './timing';
import type { JobHandler, JobRecord } from './queue.types';
import type { AppLogger } from '../utils/logger';

export async function runJobHandler(job: JobRecord, handler: JobHandler): Promise<void> {
  const timeoutMs = job.timeoutMs;
  await withTimeout(
    runWithJobContext({ requestId: job.payload.requestId, jobId: job.id }, () =>
      handler(job.payload, withProgress(job)),
    ),
    timeoutMs,
    'Background job timed out',
  );
}

export function withProgress(job: JobRecord): JobRecord {
  if (job.updateProgress) {
    return {
      ...job,
      updateProgress: async (progress: number) => job.updateProgress(clampProgress(progress)),
    };
  }

  return {
    ...job,
    updateProgress: async () => undefined,
  };
}

export function shouldRetry(job: JobRecord, error: unknown): boolean {
  if (!job.retryable || job.attempts >= job.maxAttempts) {
    return false;
  }

  return isRetryableJobError(error);
}

export function logJobFailure(logger: AppLogger | undefined, job: JobRecord, error: unknown): void {
  logger?.warn(
    {
      jobId: job.id,
      jobName: job.name,
      attempt: job.attempts,
      maxAttempts: job.maxAttempts,
      requestId: job.payload.requestId,
      error: jobErrorMessage(error),
    },
    'Background job failed',
  );
}

export function publicJobError(error: unknown): string {
  if (error instanceof TimeoutError) {
    return sanitizeErrorMessage(error.message);
  }

  return jobErrorMessage(error);
}
