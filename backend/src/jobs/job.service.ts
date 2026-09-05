import type { AuthenticatedUser } from '../auth/types';
import { NotFoundError } from '../errors';
import { ROLES } from '../rbac/catalog';
import { parseParams } from '../schemas/parse';
import { toPublicJobStatus } from './status';
import { jobIdParamsSchema } from './job.schemas';
import type { JobQueue, JobStatusRecord, PublicJobStatus } from './queue.types';

export type JobStatusActor = Pick<AuthenticatedUser, 'id' | 'roles'>;

export function canReadJobStatus(
  record: Pick<JobStatusRecord, 'createdBy'>,
  actor: JobStatusActor,
): boolean {
  if (!record.createdBy) {
    return true;
  }
  if (record.createdBy === actor.id) {
    return true;
  }
  return actor.roles.includes(ROLES.ADMIN);
}

export class JobService {
  constructor(private readonly jobs: JobQueue) {}

  async getById(jobId: string, actor: JobStatusActor): Promise<PublicJobStatus> {
    const parsed = parseParams(jobIdParamsSchema, { jobId });
    const record = await this.jobs.getJob(parsed.jobId);
    if (!record || !canReadJobStatus(record, actor)) {
      throw new NotFoundError('Job not found', { jobId: parsed.jobId });
    }

    return toPublicJobStatus(record);
  }
}
