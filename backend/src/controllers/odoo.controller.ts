import type { Request, Response } from 'express';

import { ERROR_CODES } from '../constants';
import type { OdooService } from '../integrations/odoo';
import { asyncHandler } from '../utils/async-handler';
import { sendError, sendSuccess } from '../utils/response';

export class OdooController {
  constructor(private readonly odoo: OdooService | null) {}

  getHealth = asyncHandler(async (req: Request, res: Response) => {
    if (!this.odoo) {
      return sendSuccess(res, {
        configured: false,
        healthy: true,
        skipped: true,
      });
    }

    const check = await this.odoo.checkConnectivity();
    if (!check.healthy) {
      return sendError(res, {
        statusCode: 503,
        code: ERROR_CODES.NOT_READY,
        message: 'Odoo is unavailable',
        details: { check },
        requestId: req.requestId,
      });
    }

    return sendSuccess(res, check);
  });
}
