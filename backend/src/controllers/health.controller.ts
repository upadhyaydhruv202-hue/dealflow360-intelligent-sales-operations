import type { Request, Response } from 'express';

import { ERROR_CODES } from '../constants';
import type { HealthService } from '../services/health.service';
import { asyncHandler } from '../utils/async-handler';
import { sendError, sendSuccess } from '../utils/response';

export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  getHealth = asyncHandler((_req: Request, res: Response) => {
    const data = this.healthService.getHealth();
    return sendSuccess(res, data, 200, { version: '0.1.0' });
  });

  getReady = asyncHandler(async (req: Request, res: Response) => {
    const data = await this.healthService.getReadiness();

    if (data.status !== 'ready') {
      return sendError(res, {
        statusCode: 503,
        code: ERROR_CODES.NOT_READY,
        message: 'One or more required dependencies are unavailable',
        details: { checks: data.checks },
        requestId: req.requestId,
      });
    }

    return sendSuccess(res, data);
  });
}
