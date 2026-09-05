import type { Request, Response } from 'express';

import { AuthenticationError, ExternalServiceError } from '../errors';
import { parseParams } from '../schemas/parse';
import { asyncHandler } from '../utils/async-handler';
import { sendSuccess } from '../utils/response';
import { jobIdParamsSchema } from '../jobs/job.schemas';
import type { JobService } from '../jobs/job.service';

export class JobController {
  constructor(private readonly jobs: JobService | null) {}

  getById = asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const params = parseParams(jobIdParamsSchema, req.params);
    const status = await this.requireJobs().getById(params.jobId, user);
    return sendSuccess(res, status);
  });

  private requireJobs(): JobService {
    if (!this.jobs) {
      throw new ExternalServiceError('Job status is not available', { provider: 'jobs' });
    }

    return this.jobs;
  }
}

function requireUser(req: Request) {
  if (!req.user) {
    throw new AuthenticationError();
  }

  return req.user;
}
