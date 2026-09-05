import type { Request, Response } from 'express';

import { AuthenticationError } from '../errors';
import type { CapabilityRecommendationService } from '../capability-recommendations';
import { capabilityRecommendBodySchema } from '../capability-recommendations';
import type { CapabilityRecommendationInput } from '../capability-recommendations';
import { requireEnabledService } from '../features';
import { parseBody } from '../schemas/parse';
import { asyncHandler } from '../utils/async-handler';
import { sendSuccess } from '../utils/response';

export class CapabilityRecommendationController {
  constructor(private readonly recommendations: CapabilityRecommendationService | null) {}

  recommend = asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const body = parseBody(capabilityRecommendBodySchema, req.body);
    const result = await this.service().recommend({
      analysis: body.analysis as CapabilityRecommendationInput,
      title: body.title,
      userId: user.id,
    });
    return sendSuccess(res, result);
  });

  private service(): CapabilityRecommendationService {
    return requireEnabledService(this.recommendations, 'capabilityRecommendations');
  }
}

function requireUser(req: Request) {
  if (!req.user) {
    throw new AuthenticationError();
  }

  return req.user;
}
