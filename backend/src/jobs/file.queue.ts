import { randomUUID } from 'node:crypto';
import { access, mkdir, readdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { JOBS } from '../constants';
import { ExternalServiceError } from '../errors';
import type { AppLogger } from '../utils/logger';
import { withRequestId } from '../utils/request-context';
import { logJobFailure, publicJobError, runJobHandler, shouldRetry } from './run-handler';
import { createJobStatus, emitJobStatus, JobStatusTracker, nowIso } from './status';
import { backoffDelay, sleep } from './timing';
import type { JobEnqueueOptions, JobHandler, JobQueue, JobRecord, JobStatusRecord } from './queue.types';
import { resolveJobCreatedBy } from './created-by';

interface FileJob extends JobRecord {
  availableAt: number;
}

export interface FileJobQueueOptions {
  jobsDir: string;
  logger?: AppLogger;
  pollMs?: number;
  defaultAttempts?: number;
  defaultBackoffMs?: number;
  defaultTimeoutMs?: number;
  onStatus?: (record: JobStatusRecord) => void;
}

export class FileJobQueue implements JobQueue {
  readonly name = 'jobs';
  readonly backend = 'file' as const;
  private readonly pendingDir: string;
  private readonly processingDir: string;
  private readonly logger?: AppLogger;
  private readonly pollMs: number;
  private readonly handlers = new Map<string, JobHandler>();
  private readonly statuses: JobStatusTracker;
  private readonly idleWaiters: Array<() => void> = [];
  private readonly defaultAttempts: number;
  private readonly defaultBackoffMs: number;
  private readonly defaultTimeoutMs: number;
  private readonly onStatus?: (record: JobStatusRecord) => void;
  private timer?: NodeJS.Timeout;
  private ticking = false;
  private closed = false;
  private inFlight = 0;

  constructor(options: FileJobQueueOptions) {
    this.pendingDir = path.join(options.jobsDir, 'pending');
    this.processingDir = path.join(options.jobsDir, 'processing');
    this.statuses = new JobStatusTracker(path.join(options.jobsDir, 'status'));
    this.logger = options.logger;
    this.pollMs = options.pollMs ?? JOBS.FILE_POLL_MS;
    this.defaultAttempts = options.defaultAttempts ?? 1;
    this.defaultBackoffMs = options.defaultBackoffMs ?? 0;
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? JOBS.DEFAULT_TIMEOUT_MS;
    this.onStatus = options.onStatus;
  }

  async enqueue<T extends Record<string, unknown>>(
    name: string,
    payload: T,
    options: JobEnqueueOptions = {},
  ): Promise<string> {
    if (this.closed) {
      throw new ExternalServiceError('Job queue is closed', { provider: 'jobs' });
    }

    await this.ensureDirs();
    const id = options.jobId ?? randomUUID();
    const pendingPath = path.join(this.pendingDir, `${safeFileId(id)}.json`);
    const processingPath = path.join(this.processingDir, `${safeFileId(id)}.json`);

    if (options.jobId) {
      const existing = await this.statuses.get(options.jobId);
      if (existing && existing.status !== 'failed') {
        return id;
      }
      if (await exists(pendingPath) || await exists(processingPath)) {
        return id;
      }
    }

    const retryable = options.retryable !== false;
    const createdAt = nowIso();
    const job: FileJob = {
      id,
      name,
      payload: withRequestId(payload),
      attempts: 0,
      maxAttempts: retryable ? (options.attempts ?? this.defaultAttempts) : 1,
      backoffMs: options.backoffMs ?? this.defaultBackoffMs,
      timeoutMs: options.timeoutMs ?? this.defaultTimeoutMs,
      retryable,
      createdAt,
      availableAt: Date.now(),
      updateProgress: async () => undefined,
    };
    const queued = createJobStatus({
      jobId: id,
      type: name,
      createdAt,
      createdBy: resolveJobCreatedBy(payload, options),
    });
    await this.statuses.put(queued);
    emitJobStatus(this.onStatus, queued);
    await writeFile(pendingPath, serializeJob(job), 'utf8');
    this.ensureTimer();
    return id;
  }

  process<T extends Record<string, unknown>>(name: string, handler: JobHandler<T>): void {
    this.handlers.set(name, handler as JobHandler);
    this.ensureTimer();
  }

  async getJob(jobId: string): Promise<JobStatusRecord | null> {
    return this.statuses.get(jobId);
  }

  async pruneStatuses(maxAgeMs: number): Promise<number> {
    return this.statuses.prune(maxAgeMs);
  }

  waitForIdle(): Promise<void> {
    return new Promise((resolve) => {
      const check = () => {
        void this.isIdle().then((idle) => {
          if (idle) {
            resolve();
            return;
          }
          this.idleWaiters.push(check);
        });
      };
      check();
    });
  }

  async close(): Promise<void> {
    this.closed = true;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }

    while (this.inFlight > 0 || this.ticking) {
      await sleep(20);
    }
  }

  private ensureTimer(): void {
    if (this.closed || this.timer || this.handlers.size === 0) {
      return;
    }

    void this.recover().then(() => {
      if (this.closed) {
        return;
      }
      this.timer = setInterval(() => {
        void this.tick();
      }, this.pollMs);
      this.timer.unref?.();
      void this.tick();
    });
  }

  private async recover(): Promise<void> {
    await this.ensureDirs();
    const files = await readdir(this.processingDir).catch(() => []);
    await Promise.all(
      files
        .filter((file) => file.endsWith('.json'))
        .map(async (file) => {
          await rename(path.join(this.processingDir, file), path.join(this.pendingDir, file)).catch(
            () => undefined,
          );
        }),
    );
  }

  private async tick(): Promise<void> {
    if (this.ticking) {
      return;
    }

    this.ticking = true;
    try {
      await this.ensureDirs();
      const files = await readdir(this.pendingDir);
      for (const file of files) {
        if (this.closed) {
          break;
        }
        if (!file.endsWith('.json')) {
          continue;
        }

        const pendingPath = path.join(this.pendingDir, file);
        const processingPath = path.join(this.processingDir, file);
        try {
          await rename(pendingPath, processingPath);
        } catch {
          continue;
        }

        const job = await readJob(processingPath);
        if (!job) {
          await unlink(processingPath).catch(() => undefined);
          continue;
        }

        if (job.availableAt > Date.now()) {
          await rename(processingPath, pendingPath).catch(() => undefined);
          continue;
        }

        const handler = this.handlers.get(job.name);
        if (!handler) {
          await rename(processingPath, pendingPath).catch(() => undefined);
          continue;
        }

        this.inFlight += 1;
        try {
          await this.run(hydrateJob(job, this.statuses, this.onStatus), handler, processingPath);
        } finally {
          this.inFlight -= 1;
        }
      }
    } finally {
      this.ticking = false;
      if (await this.isIdle()) {
        while (this.idleWaiters.length > 0) {
          this.idleWaiters.shift()?.();
        }
      }
    }
  }

  private async run(job: FileJob, handler: JobHandler, processingPath: string): Promise<void> {
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
      await unlink(processingPath).catch(() => undefined);
    } catch (error) {
      logJobFailure(this.logger, job, error);

      if (shouldRetry(job, error) && !this.closed) {
        job.availableAt = Date.now() + backoffDelay(job.backoffMs, job.attempts);
        emitJobStatus(
          this.onStatus,
          await this.statuses.patch(job.id, {
            status: 'retrying',
            error: publicJobError(error),
          }),
        );
        await writeFile(path.join(this.pendingDir, `${safeFileId(job.id)}.json`), serializeJob(job), 'utf8');
        await unlink(processingPath).catch(() => undefined);
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
      await unlink(processingPath).catch(() => undefined);
    }
  }

  private async isIdle(): Promise<boolean> {
    if (this.inFlight > 0 || this.ticking) {
      return false;
    }

    const pending = await readdir(this.pendingDir).catch(() => []);
    const due = [];
    for (const file of pending.filter((name) => name.endsWith('.json'))) {
      const job = await readJob(path.join(this.pendingDir, file));
      if (job && job.availableAt <= Date.now() && this.handlers.has(job.name)) {
        due.push(file);
      }
    }

    return due.length === 0;
  }

  private async ensureDirs(): Promise<void> {
    await mkdir(this.pendingDir, { recursive: true });
    await mkdir(this.processingDir, { recursive: true });
  }
}

function hydrateJob(
  job: FileJob,
  statuses: JobStatusTracker,
  onStatus?: (record: JobStatusRecord) => void,
): FileJob {
  return {
    ...job,
    timeoutMs: job.timeoutMs ?? JOBS.DEFAULT_TIMEOUT_MS,
    retryable: job.retryable !== false,
    createdAt: job.createdAt ?? nowIso(),
    updateProgress: async (progress) => {
      const next = await statuses.patch(job.id, { progress });
      emitJobStatus(onStatus, next);
    },
  };
}

function serializeJob(job: FileJob): string {
  const { updateProgress: _updateProgress, ...rest } = job;
  return JSON.stringify(rest);
}

function safeFileId(jobId: string): string {
  return jobId.replace(/[^A-Za-z0-9._-]/g, '_');
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJob(filePath: string): Promise<FileJob | null> {
  try {
    const parsed = JSON.parse(await readFile(filePath, 'utf8')) as FileJob;
    if (!parsed?.id || !parsed.name) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
