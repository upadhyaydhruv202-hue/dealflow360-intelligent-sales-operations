import { Queue, UnrecoverableError, Worker, type Job, type JobsOptions } from 'bullmq';
import IORedis from 'ioredis';

import { JOBS } from '../constants';
import { ExternalServiceError } from '../errors';
import type { AppLogger } from '../utils/logger';
import { runWithJobContext, withRequestId } from '../utils/request-context';
import { isRetryableJobError } from './retry';
import { clampProgress, emitJobStatus, jobErrorMessage } from './status';
import { withTimeout } from './timing';
import type { JobEnqueueOptions, JobHandler, JobQueue, JobRecord, JobStatusRecord } from './queue.types';
import { resolveJobCreatedBy } from './created-by';

export interface BullMqJobQueueOptions {
  redisUrl: string;
  logger?: AppLogger;
  queueName?: string;
  defaultAttempts?: number;
  defaultBackoffMs?: number;
  defaultTimeoutMs?: number;
  onStatus?: (record: JobStatusRecord) => void;
}

function createConnection(url: string): IORedis {
  return new IORedis(url, {
    maxRetriesPerRequest: null,
    lazyConnect: true,
  });
}

export class BullMqJobQueue implements JobQueue {
  readonly name = 'jobs';
  readonly backend = 'bullmq' as const;
  private readonly logger?: AppLogger;
  private readonly queueName: string;
  private readonly redisUrl: string;
  private readonly queueConnection: IORedis;
  private readonly queue: Queue;
  private readonly defaultAttempts: number;
  private readonly defaultBackoffMs: number;
  private readonly defaultTimeoutMs: number;
  private readonly onStatus?: (record: JobStatusRecord) => void;
  private workerConnection?: IORedis;
  private readonly handlers = new Map<string, JobHandler>();
  private worker?: Worker;
  private closed = false;

  constructor(options: BullMqJobQueueOptions) {
    this.logger = options.logger;
    this.queueName = options.queueName ?? JOBS.QUEUE_NAME;
    this.redisUrl = options.redisUrl;
    this.defaultAttempts = options.defaultAttempts ?? 1;
    this.defaultBackoffMs = options.defaultBackoffMs ?? JOBS.DEFAULT_BACKOFF_MS;
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? JOBS.DEFAULT_TIMEOUT_MS;
    this.onStatus = options.onStatus;
    this.queueConnection = createConnection(options.redisUrl);
    this.queue = new Queue(this.queueName, {
      connection: this.queueConnection,
    });
  }

  async enqueue<T extends Record<string, unknown>>(
    name: string,
    payload: T,
    options: JobEnqueueOptions = {},
  ): Promise<string> {
    if (this.closed) {
      throw new ExternalServiceError('Job queue is closed', { provider: 'jobs' });
    }

    const retryable = options.retryable !== false;
    const createdBy = resolveJobCreatedBy(payload, options);
    const data = withRequestId({
      ...payload,
      __timeoutMs: options.timeoutMs ?? this.defaultTimeoutMs,
      __retryable: retryable,
      ...(createdBy ? { __createdBy: createdBy } : {}),
    });
    const jobOptions: JobsOptions = {
      attempts: retryable ? (options.attempts ?? this.defaultAttempts) : 1,
      backoff: {
        type: 'exponential',
        delay: Math.max(options.backoffMs ?? this.defaultBackoffMs, 1),
      },
      removeOnComplete: { age: Math.floor(JOBS.STATUS_TTL_MS / 1000) },
      removeOnFail: { age: Math.floor(JOBS.STATUS_TTL_MS / 1000) },
      jobId: options.jobId,
    };

    try {
      const job = await this.queue.add(name, data, jobOptions);
      const record = await this.getJob(String(job.id));
      emitJobStatus(this.onStatus, record);
      return String(job.id);
    } catch (error) {
      if (options.jobId && isDuplicateJobError(error)) {
        return this.resolveDuplicateJobId(name, data, jobOptions, options.jobId);
      }

      throw new ExternalServiceError('Failed to enqueue background job', {
        provider: 'jobs',
        jobName: name,
        cause: error instanceof Error ? error.message : 'enqueue failed',
      });
    }
  }

  process<T extends Record<string, unknown>>(name: string, handler: JobHandler<T>): void {
    this.handlers.set(name, handler as JobHandler);
    this.ensureWorker();
  }

  async getJob(jobId: string): Promise<JobStatusRecord | null> {
    const job = await this.queue.getJob(jobId);
    if (!job) {
      return null;
    }

    const state = await job.getState();
    return toStatusRecord(job, state);
  }

  async pruneStatuses(_maxAgeMs: number): Promise<number> {
    return 0;
  }

  async waitForIdle(): Promise<void> {
    for (;;) {
      const counts = await this.queue.getJobCounts('wait', 'active', 'delayed');
      if ((counts.wait ?? 0) + (counts.active ?? 0) + (counts.delayed ?? 0) === 0) {
        return;
      }

      await sleep(50);
    }
  }

  async close(): Promise<void> {
    this.closed = true;
    await this.worker?.close();
    await this.queue.close();
    this.queueConnection.disconnect();
    this.workerConnection?.disconnect();
  }

  private async resolveDuplicateJobId(
    name: string,
    data: Record<string, unknown>,
    jobOptions: JobsOptions,
    jobId: string,
  ): Promise<string> {
    const existing = await this.queue.getJob(jobId);
    if (existing) {
      const state = await existing.getState();
      if (state === 'failed') {
        await existing.remove();
        const job = await this.queue.add(name, data, jobOptions);
        return String(job.id);
      }
    }

    return jobId;
  }

  private ensureWorker(): void {
    if (this.worker) {
      return;
    }

    this.workerConnection = createConnection(this.redisUrl);
    this.worker = new Worker(
      this.queueName,
      async (job) => {
        const handler = this.handlers.get(job.name);
        if (!handler) {
          throw new UnrecoverableError(`No handler registered for job ${job.name}`);
        }

        const record = toJobRecord(job, async (progress) => {
          await job.updateProgress(clampProgress(progress));
          emitJobStatus(this.onStatus, toStatusRecord(job, 'active'));
        });

        try {
          await withTimeout(
            runWithJobContext(
              { requestId: (job.data as { requestId?: string }).requestId, jobId: String(job.id) },
              () => handler(job.data as JobRecord['payload'], record),
            ),
            record.timeoutMs,
            'Background job timed out',
          );
        } catch (error) {
          if (!record.retryable || !isRetryableJobError(error)) {
            throw new UnrecoverableError(jobErrorMessage(error));
          }

          throw error;
        }
      },
      { connection: this.workerConnection },
    );

    this.worker.on('active', (job) => {
      emitJobStatus(this.onStatus, toStatusRecord(job, 'active'));
    });
    this.worker.on('completed', (job) => {
      emitJobStatus(this.onStatus, toStatusRecord(job, 'completed'));
    });
    this.worker.on('failed', (job, error) => {
      if (job) {
        emitJobStatus(this.onStatus, toStatusRecord(job, 'failed'));
      }
      this.logger?.warn(
        {
          jobId: job?.id,
          jobName: job?.name,
          attempt: job?.attemptsMade,
          requestId:
            job?.data && typeof job.data === 'object' && 'requestId' in job.data
              ? String((job.data as { requestId?: string }).requestId)
              : undefined,
          error: jobErrorMessage(error),
        },
        'Background job failed',
      );
    });
  }
}

function toJobRecord(job: Job, updateProgress: (progress: number) => Promise<void>): JobRecord {
  const backoff = job.opts.backoff;
  const backoffMs = typeof backoff === 'object' && backoff ? backoff.delay ?? 0 : 0;
  const data = (job.data ?? {}) as Record<string, unknown>;

  return {
    id: String(job.id ?? ''),
    name: job.name,
    payload: job.data as JobRecord['payload'],
    attempts: job.attemptsMade,
    maxAttempts: job.opts.attempts ?? 1,
    backoffMs,
    timeoutMs: typeof data.__timeoutMs === 'number' ? data.__timeoutMs : JOBS.DEFAULT_TIMEOUT_MS,
    retryable: data.__retryable !== false,
    createdAt: new Date(job.timestamp).toISOString(),
    updateProgress,
  };
}

function toStatusRecord(job: Job, state: string): JobStatusRecord {
  const attemptsMade = job.attemptsMade ?? 0;
  const status = mapBullState(state, attemptsMade);
  const progress =
    typeof job.progress === 'number'
      ? clampProgress(job.progress)
      : status === 'completed'
        ? 100
        : 0;
  const data = (job.data ?? {}) as Record<string, unknown>;
  const createdBy = typeof data.__createdBy === 'string' ? data.__createdBy : undefined;

  return {
    jobId: String(job.id ?? ''),
    type: job.name,
    status,
    attempts: attemptsMade,
    createdAt: new Date(job.timestamp).toISOString(),
    startedAt: job.processedOn ? new Date(job.processedOn).toISOString() : undefined,
    completedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : undefined,
    error: job.failedReason ? jobErrorMessage(job.failedReason) : undefined,
    progress,
    createdBy,
  };
}

function mapBullState(state: string, attemptsMade: number): JobStatusRecord['status'] {
  switch (state) {
    case 'active':
      return 'processing';
    case 'completed':
      return 'completed';
    case 'failed':
      return 'failed';
    case 'delayed':
      return attemptsMade > 0 ? 'retrying' : 'queued';
    default:
      return attemptsMade > 0 ? 'retrying' : 'queued';
  }
}

function isDuplicateJobError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return /already exists/i.test(error.message);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
