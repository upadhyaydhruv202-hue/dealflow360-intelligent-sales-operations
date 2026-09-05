import type { Request, Response } from 'express';

import { getPublicFeatureState } from '../features';
import type { AppConfig } from '../types/config';
import { asyncHandler } from '../utils/async-handler';
import { sendSuccess } from '../utils/response';

export class FeaturesController {
  constructor(private readonly config: AppConfig) {}

  getFeatures = asyncHandler((_req: Request, res: Response) => {
    return sendSuccess(res, getPublicFeatureState(this.config));
  });
}
