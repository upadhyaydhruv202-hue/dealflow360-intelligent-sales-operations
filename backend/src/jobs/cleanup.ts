import { JOB_NAMES } from '../constants';
import type { KvStore } from '../lib/kv';
import { parseWithSchema } from '../schemas/parse';
import { cleanupJobPayloadSchema, DEFAULT_CLEANUP_MAX_AGE_MS } from './job.schemas';
import type { JobQueue } from './queue.types';

export function registerCleanupJob(jobs: JobQueue, kv: KvStore): void {
  jobs.process(JOB_NAMES.CLEANUP, async (payload, job) => {
    const parsed = parseWithSchema(cleanupJobPayloadSchema, payload, {
      source: 'job',
      message: 'Invalid cleanup job payload',
    });
    await job.updateProgress(20);
    if (kv.pruneExpired) {
      await kv.pruneExpired();
    }
    await job.updateProgress(60);
    await jobs.pruneStatuses(parsed.maxAgeMs ?? DEFAULT_CLEANUP_MAX_AGE_MS);
    await job.updateProgress(100);
  });
}
