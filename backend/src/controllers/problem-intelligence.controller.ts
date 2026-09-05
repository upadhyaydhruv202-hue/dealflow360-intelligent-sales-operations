import type { Request, Response } from 'express';

import { AuthenticationError } from '../errors';
import type { ProblemIntelligenceService } from '../problem-intelligence';
import { problemIntelligenceAnalyzeBodySchema } from '../problem-intelligence';
import { requireEnabledService } from '../features';
import { parseBody } from '../schemas/parse';
import { asyncHandler } from '../utils/async-handler';
import { sendSuccess } from '../utils/response';

export class ProblemIntelligenceController {
  constructor(private readonly intelligence: ProblemIntelligenceService | null) {}

  analyze = asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const body = parseBody(problemIntelligenceAnalyzeBodySchema, req.body);
    const result = await this.service().analyze({
      statement: body.statement,
      title: body.title,
      userId: user.id,
    });
    return sendSuccess(res, result);
  });

  private service(): ProblemIntelligenceService {
    return requireEnabledService(this.intelligence, 'problemIntelligence');
  }
}

function requireUser(req: Request) {
  if (!req.user) {
    throw new AuthenticationError();
  }

  return req.user;
}
