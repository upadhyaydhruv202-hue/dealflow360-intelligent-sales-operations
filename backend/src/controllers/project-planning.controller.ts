import type { Request, Response } from 'express';

import { AuthenticationError } from '../errors';
import type { ProjectPlanningService } from '../project-planning';
import {
  projectPlanningAnalyzeBodySchema,
  projectPlanningSelectionBodySchema,
} from '../project-planning';
import { requireEnabledService } from '../features';
import { parseBody } from '../schemas/parse';
import { asyncHandler } from '../utils/async-handler';
import { sendSuccess } from '../utils/response';

export class ProjectPlanningController {
  constructor(private readonly planning: ProjectPlanningService | null) {}

  analyze = asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const body = parseBody(projectPlanningAnalyzeBodySchema, req.body);
    const result = await this.service().analyze({
      statement: body.statement,
      title: body.title,
      userId: user.id,
    });
    return sendSuccess(res, result);
  });

  validate = asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const body = parseBody(projectPlanningSelectionBodySchema, req.body);
    const result = await this.service().validate({ ...body, userId: user.id });
    return sendSuccess(res, result);
  });

  approve = asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const body = parseBody(projectPlanningSelectionBodySchema, req.body);
    const result = await this.service().approve({ ...body, userId: user.id });
    return sendSuccess(res, result);
  });

  private service(): ProjectPlanningService {
    return requireEnabledService(this.planning, 'projectPlanning');
  }
}

function requireUser(req: Request) {
  if (!req.user) {
    throw new AuthenticationError();
  }

  return req.user;
}
