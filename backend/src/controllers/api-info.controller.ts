import type { Request, Response } from 'express';

import { API_VERSION } from '../constants';
import type { AppConfig } from '../types/config';
import { asyncHandler } from '../utils/async-handler';
import { sendSuccess } from '../utils/response';

export class ApiInfoController {
  constructor(private readonly config: AppConfig) {}

  getInfo = asyncHandler((_req: Request, res: Response) => {
    return sendSuccess(res, {
      name: this.config.app.name,
      version: API_VERSION,
      status: 'ok',
    });
  });
}
