import { randomUUID } from 'node:crypto';

import { JOBS } from '../constants';
import { ExternalServiceError } from '../errors';
import { METRIC_NAMES } from '../observability/types';
import { recordJobMetric } from '../observability/record';
import type { MetricsSink } from '../observability/types';
import type { AppLogger } from '../utils/logger';
import { withRequestId } from '../utils/request-context';
import { BullMqJobQueue } from './bullmq.queue';
import { FileJobQueue } from './file.queue';
import { logJobFailure, publicJobError, runJobHandler, shouldRetry } from './run-handler';
import { createJobStatus, emitJobStatus, JobStatusTracker, nowIso } from './status';
import { backoffDelay, sleep } from './timing';
import type { JobEnqueueOptions, JobHandler, JobQueue, JobRecord, JobStatusRecord } from './queue.types';
import { resolveJobCreatedBy } from './created-by';

export type { JobEnqueueOptions, JobHandler, JobQueue, JobRecord, JobStatusRecord } from './queue.types';
export type { PublicJobStatus } from './queue.types';

export interface CreateJobQueueOptions {
  logger?: AppLogger;
  redisUrl?: string;
  jobsDir?: string;
  defaultAttempts?: number;
  defaultBackoffMs?: number;
  defaultTimeoutMs?: number;
  processJobs?: boolean;
  metrics?: MetricsSink | null;
  onStatus?: (record: JobStatusRecord) => void;
}

export class InMemoryJobQueue implements JobQueue {
  readonly name = 'jobs';
  readonly backend = 'memory' as const;
  private readonly handlers = new Map<string, JobHandler>();
  private readonly pending: JobRecord[] = [];
  private readonly statuses = new JobStatusTracker();
  private draining = false;
  private closed = false;
  private readonly idleWaiters: Array<() => void> = [];
  private readonly defaultAttempts: number;
  private readonly defaultBackoffMs: number;
  private readonly defaultTimeoutMs: number;
  private readonly onStatus?: (record: JobStatusRecord) => void;

  constructor(
    private readonly logger?: AppLogger,
    defaults: {
      attempts?: number;
      backoffMs?: number;
      timeoutMs?: number;
      onStatus?: (record: JobStatusRecord) => void;
    } = {},
  ) {
    this.defaultAttempts = defaults.attempts ?? 1;
    this.defaultBackoffMs = defaults.backoffMs ?? 0;
    this.defaultTimeoutMs = defaults.timeoutMs ?? JOBS.DEFAULT_TIMEOUT_MS;
    this.onStatus = defaults.onStatus;
  }

  async enqueue<T extends Record<string, unknown>>(
    name: string,
    payload: T,
    options: JobEnqueueOptions = {},
  ): Promise<string> {
    if (this.closed) {
      throw new ExternalServiceError('Job queue is closed', { provider: 'jobs' });
    }

    if (options.jobId) {
      const existing = await this.statuses.get(options.jobId);
      if (existing && existing.status !== 'failed') {
        return options.jobId;
      }
    }

    const retryable = options.retryable !== false;
    const id = options.jobId ?? randomUUID();
    const job: JobRecord<T> = {
      id,
      name,
      payload: withRequestId(payload),
      attempts: 0,
      maxAttempts: retryable ? (options.attempts ?? this.defaultAttempts) : 1,
      backoffMs: options.backoffMs ?? this.defaultBackoffMs,
      timeoutMs: options.timeoutMs ?? this.defaultTimeoutMs,
      retryable,
      createdAt: nowIso(),
      updateProgress: async (progress) => {
        const next = await this.statuses.patch(id, { progress });
        emitJobStatus(this.onStatus, next);
      },
    };
    const queued = createJobStatus({
      jobId: job.id,
      type: name,
      createdAt: job.createdAt,
      createdBy: resolveJobCreatedBy(payload, options),
    });
    await this.statuses.put(queued);
    emitJobStatus(this.onStatus, queued);
    this.pending.push(job as JobRecord);
    void this.drain();
    return job.id;
  }

  process<T extends Record<string, unknown>>(name: string, handler: JobHandler<T>): void {
    this.handlers.set(name, handler as JobHandler);
    void this.drain();
  }

  async getJob(jobId: string): Promise<JobStatusRecord | null> {
    return this.statuses.get(jobId);
  }

  async pruneStatuses(maxAgeMs: number): Promise<number> {
    return this.statuses.prune(maxAgeMs);
  }

  waitForIdle(): Promise<void> {
    if (!this.draining && this.pending.length === 0) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      this.idleWaiters.push(resolve);
    });
  }

  async close(): Promise<void> {
    this.closed = true;
    await this.waitForIdle();
  }

  private async drain(): Promise<void> {
    if (this.draining) {
      return;
    }

    this.draining = true;

    try {
      while (this.pending.length > 0) {
        const job = this.pending.shift();
        if (!job) {
          break;
        }

        const handler = this.handlers.get(job.name);
        if (!handler) {
          this.pending.unshift(job);
          break;
        }

        try {
          await this.run(job, handler);
        } catch {
          // Exhausted retries. Status is persisted as failed.
        }
      }
    } finally {
      this.draining = false;
      if (this.pending.length === 0) {
        while (this.idleWaiters.length > 0) {
          this.idleWaiters.shift()?.();
        }
      }
    }
  }

  private async run(job: JobRecord, handler: JobHandler): Promise<void> {
    job.attempts += 1;
    emitJobStatus(
      this.onStatus,
      await this.statuses.patch(job.id, {
        status: 'processing',
        attempts: job.attempts,
        startedAt: nowIso(),
        progress: 0,
      }),
    );

    try {
      await runJobHandler(job, handler);
      emitJobStatus(
        this.onStatus,
        await this.statuses.patch(job.id, {
          status: 'completed',
          completedAt: nowIso(),
          progress: 100,
          error: undefined,
        }),
      );
    } catch (error) {
      logJobFailure(this.logger, job, error);

      if (shouldRetry(job, error)) {
        emitJobStatus(
          this.onStatus,
          await this.statuses.patch(job.id, {
            status: 'retrying',
            error: publicJobError(error),
          }),
        );
        await sleep(backoffDelay(job.backoffMs, job.attempts));
        this.pending.push(job);
        return;
      }

      emitJobStatus(
        this.onStatus,
        await this.statuses.patch(job.id, {
          status: 'failed',
          completedAt: nowIso(),
          error: publicJobError(error),
        }),
      );
      throw error;
    }
  }
}

const CREATE_QUEUE_KEYS: Array<keyof CreateJobQueueOptions> = [
  'redisUrl',
  'logger',
  'jobsDir',
  'defaultAttempts',
  'defaultBackoffMs',
  'defaultTimeoutMs',
  'processJobs',
  'metrics',
  'onStatus',
];

function isCreateJobQueueOptions(
  value: AppLogger | CreateJobQueueOptions,
): value is CreateJobQueueOptions {
  return CREATE_QUEUE_KEYS.some((key) => key in (value as object));
}

export function createJobQueue(
  loggerOrOptions?: AppLogger | CreateJobQueueOptions,
): JobQueue {
  const options: CreateJobQueueOptions = !loggerOrOptions
    ? {}
    : isCreateJobQueueOptions(loggerOrOptions)
      ? loggerOrOptions
      : { logger: loggerOrOptions };

  const defaults = {
    attempts: options.defaultAttempts,
    backoffMs: options.defaultBackoffMs,
    timeoutMs: options.defaultTimeoutMs,
  };

  if (options.redisUrl) {
    return gateJobProcessing(
      instrumentJobQueue(
        new BullMqJobQueue({
          redisUrl: options.redisUrl,
          logger: options.logger,
          defaultAttempts: options.defaultAttempts,
          defaultBackoffMs: options.defaultBackoffMs,
          defaultTimeoutMs: options.defaultTimeoutMs,
          onStatus: options.onStatus,
        }),
        options.metrics,
      ),
      options.processJobs,
    );
  }

  if (options.jobsDir) {
    return gateJobProcessing(
      instrumentJobQueue(
        new FileJobQueue({
          jobsDir: options.jobsDir,
          logger: options.logger,
          defaultAttempts: options.defaultAttempts,
          defaultBackoffMs: options.defaultBackoffMs,
          defaultTimeoutMs: options.defaultTimeoutMs,
          onStatus: options.onStatus,
        }),
        options.metrics,
      ),
      options.processJobs,
    );
  }

  return gateJobProcessing(
    instrumentJobQueue(
      new InMemoryJobQueue(options.logger, { ...defaults, onStatus: options.onStatus }),
      options.metrics,
    ),
    options.processJobs,
  );
}

function gateJobProcessing(queue: JobQueue, processJobs?: boolean): JobQueue {
  if (processJobs !== false) {
    return queue;
  }

  queue.process = () => {
    // Enqueue-only process: workers consume jobs.
  };
  return queue;
}

function instrumentJobQueue(queue: JobQueue, metrics?: MetricsSink | null): JobQueue {
  if (!metrics) {
    return queue;
  }

  const originalEnqueue = queue.enqueue.bind(queue);
  const originalProcess = queue.process.bind(queue);

  queue.enqueue = async (name, payload, options) => {
    const id = await originalEnqueue(name, payload, options);
    metrics.increment(METRIC_NAMES.JOBS_ENQUEUED, 1, { job: name });
    return id;
  };

  queue.process = (name, handler) => {
    originalProcess(name, (async (payload, job) => {
      const started = Date.now();
      try {
        await (handler as JobHandler)(payload, job);
        recordJobMetric(metrics, { job: name, status: 'completed', durationMs: Date.now() - started });
      } catch (error) {
        recordJobMetric(metrics, { job: name, status: 'failed', durationMs: Date.now() - started });
        throw error;
      }
    }) as JobHandler);
  };

  return queue;
}
