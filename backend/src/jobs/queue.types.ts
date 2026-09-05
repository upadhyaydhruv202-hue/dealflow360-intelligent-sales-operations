import type { Closable } from '../types/lifecycle';
import type { JobStatusName } from '../constants';

export interface JobEnqueueOptions {
  attempts?: number;
  backoffMs?: number;
  jobId?: string;
  timeoutMs?: number;
  retryable?: boolean;
  createdBy?: string;
}

export interface JobStatusRecord {
  jobId: string;
  type: string;
  status: JobStatusName;
  attempts: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  progress?: number;
  createdBy?: string;
}

export interface PublicJobStatus {
  jobId: string;
  type: string;
  status: JobStatusName;
  attempts: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
  progress: number;
}

export interface JobRecord<T extends Record<string, unknown> = Record<string, unknown>> {
  id: string;
  name: string;
  payload: T & { requestId: string };
  attempts: number;
  maxAttempts: number;
  backoffMs: number;
  timeoutMs: number;
  retryable: boolean;
  createdAt: string;
  updateProgress: (progress: number) => Promise<void>;
}

export type JobHandler<T extends Record<string, unknown> = Record<string, unknown>> = (
  payload: T & { requestId: string },
  job: JobRecord<T>,
) => Promise<void>;

export interface JobQueue extends Closable {
  readonly backend: 'memory' | 'bullmq' | 'file';
  enqueue<T extends Record<string, unknown>>(
    name: string,
    payload: T,
    options?: JobEnqueueOptions,
  ): Promise<string>;
  process<T extends Record<string, unknown>>(name: string, handler: JobHandler<T>): void;
  getJob(jobId: string): Promise<JobStatusRecord | null>;
  waitForIdle(): Promise<void>;
  pruneStatuses(maxAgeMs: number): Promise<number>;
}
