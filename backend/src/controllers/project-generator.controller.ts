import type { Request, Response } from 'express';

import { AuthenticationError } from '../errors';
import type { ProjectGeneratorService } from '../project-generator';
import { projectGeneratorBodySchema } from '../project-generator';
import { requireEnabledService } from '../features';
import { parseBody } from '../schemas/parse';
import { asyncHandler } from '../utils/async-handler';
import { sendSuccess } from '../utils/response';

export class ProjectGeneratorController {
  constructor(private readonly generator: ProjectGeneratorService | null) {}

  preview = asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const body = parseBody(projectGeneratorBodySchema, req.body);
    const result = await this.service().preview({ ...body, userId: user.id });
    return sendSuccess(res, result);
  });

  generate = asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const body = parseBody(projectGeneratorBodySchema, req.body);
    const result = await this.service().generate({ ...body, userId: user.id });
    return sendSuccess(res, result);
  });

  private service(): ProjectGeneratorService {
    return requireEnabledService(this.generator, 'projectGenerator');
  }
}

function requireUser(req: Request) {
  if (!req.user) {
    throw new AuthenticationError();
  }

  return req.user;
}
