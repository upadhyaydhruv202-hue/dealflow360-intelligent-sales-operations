import { mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { JOBS, type JobStatusName } from '../constants';
import { sanitizeErrorMessage } from '../errors/sanitize';
import type { JobStatusRecord, PublicJobStatus } from './queue.types';

export function nowIso(): string {
  return new Date().toISOString();
}

export function createJobStatus(input: {
  jobId: string;
  type: string;
  status?: JobStatusName;
  attempts?: number;
  createdAt?: string;
  createdBy?: string;
}): JobStatusRecord {
  return {
    jobId: input.jobId,
    type: input.type,
    status: input.status ?? 'queued',
    attempts: input.attempts ?? 0,
    createdAt: input.createdAt ?? nowIso(),
    progress: 0,
    createdBy: input.createdBy,
  };
}

export function toPublicJobStatus(record: JobStatusRecord): PublicJobStatus {
  return {
    jobId: record.jobId,
    type: record.type,
    status: record.status,
    attempts: record.attempts,
    createdAt: record.createdAt,
    startedAt: record.startedAt ?? null,
    completedAt: record.completedAt ?? null,
    error: record.error ? sanitizeErrorMessage(record.error) : null,
    progress: record.progress ?? 0,
  };
}

export function clampProgress(progress: number): number {
  if (!Number.isFinite(progress)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(progress)));
}

export function jobErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : 'Job failed';
  return sanitizeErrorMessage(raw);
}

export class JobStatusTracker {
  private readonly memory = new Map<string, JobStatusRecord>();
  private readonly fileDir?: string;

  constructor(fileDir?: string) {
    this.fileDir = fileDir;
  }

  async put(record: JobStatusRecord): Promise<void> {
    this.memory.set(record.jobId, record);
    await this.persist(record);
  }

  async patch(jobId: string, patch: Partial<JobStatusRecord>): Promise<JobStatusRecord | null> {
    const current = await this.get(jobId);
    if (!current) {
      return null;
    }

    const next = { ...current, ...patch, jobId: current.jobId, type: patch.type ?? current.type };
    await this.put(next);
    return next;
  }

  async get(jobId: string): Promise<JobStatusRecord | null> {
    const cached = this.memory.get(jobId);
    if (cached) {
      return cached;
    }

    if (!this.fileDir) {
      return null;
    }

    try {
      const parsed = JSON.parse(await readFile(this.filePath(jobId), 'utf8')) as JobStatusRecord;
      if (!parsed?.jobId || !parsed.type) {
        return null;
      }
      this.memory.set(jobId, parsed);
      return parsed;
    } catch {
      return null;
    }
  }

  async prune(maxAgeMs: number): Promise<number> {
    const cutoff = Date.now() - maxAgeMs;
    let removed = 0;

    const ids = new Set(this.memory.keys());
    if (this.fileDir) {
      const files = await readdir(this.fileDir).catch(() => []);
      for (const file of files) {
        if (file.endsWith('.json')) {
          ids.add(file.slice(0, -5));
        }
      }
    }

    for (const jobId of ids) {
      const record = await this.get(jobId);
      if (!record) {
        continue;
      }

      const stamp = Date.parse(record.completedAt ?? record.createdAt);
      const terminal = record.status === 'completed' || record.status === 'failed';
      if (terminal && Number.isFinite(stamp) && stamp <= cutoff) {
        this.memory.delete(jobId);
        if (this.fileDir) {
          await unlink(this.filePath(jobId)).catch(() => undefined);
        }
        removed += 1;
      }
    }

    return removed;
  }

  private async persist(record: JobStatusRecord): Promise<void> {
    if (!this.fileDir) {
      return;
    }

    await mkdir(this.fileDir, { recursive: true });
    await writeFile(this.filePath(record.jobId), JSON.stringify(record), 'utf8');
  }

  private filePath(jobId: string): string {
    const safe = jobId.replace(/[^A-Za-z0-9._-]/g, '_');
    return path.join(this.fileDir ?? '', `${safe}.json`);
  }
}

export function emitJobStatus(
  listener: ((record: JobStatusRecord) => void) | undefined,
  record: JobStatusRecord | null | undefined,
): void {
  if (!listener || !record) {
    return;
  }

  try {
    listener(record);
  } catch {
    // Job processing must not fail because a status listener threw.
  }
}

export const DEFAULT_JOB_TIMEOUT_MS = JOBS.DEFAULT_TIMEOUT_MS;
