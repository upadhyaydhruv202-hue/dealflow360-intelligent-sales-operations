import type { Request, Response } from 'express';

import type { AnomalyService } from '../anomaly';
import {
  anomalyEvaluateBodySchema,
  anomalyFindingParamsSchema,
  anomalyListQuerySchema,
} from '../anomaly/anomaly.schemas';
import { AuthenticationError, FeatureDisabledError } from '../errors';
import { parseBody, parseParams, parseQuery } from '../schemas/parse';
import { asyncHandler } from '../utils/async-handler';
import { sendSuccess } from '../utils/response';

export class AnomalyController {
  constructor(private readonly anomaly: AnomalyService | null) {}

  evaluate = asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const body = parseBody(anomalyEvaluateBodySchema, req.body);
    const result = await this.service().evaluate({
      ...body,
      userId: user.id,
    });
    return sendSuccess(res, result, result.status === 'processing' ? 202 : 200);
  });

  list = asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const query = parseQuery(anomalyListQuerySchema, req.query);
    const result = await this.service().listFindings({ ...query, createdBy: user.id });
    return sendSuccess(res, { items: result.items }, 200, { ...result.meta });
  });

  getFinding = asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const params = parseParams(anomalyFindingParamsSchema, req.params);
    const finding = await this.service().getFinding(params.id, user.id);
    return sendSuccess(res, finding);
  });

  private service(): AnomalyService {
    if (!this.anomaly) {
      throw new FeatureDisabledError('anomalyDetection');
    }

    return this.anomaly;
  }
}

function requireUser(req: Request) {
  if (!req.user) {
    throw new AuthenticationError();
  }

  return req.user;
}
