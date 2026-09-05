import type { Request, Response } from 'express';

import { DatabaseError } from '../errors';
import { parseQuery } from '../schemas/parse';
import { asyncHandler } from '../utils/async-handler';
import { sendSuccess } from '../utils/response';
import { auditListQuerySchema } from '../audit/audit.schemas';
import type { AuditService } from '../audit/audit.service';

export class AuditController {
  constructor(private readonly auditService: AuditService | null) {}

  list = asyncHandler(async (req: Request, res: Response) => {
    const query = parseQuery(auditListQuerySchema, req.query);
    const result = await this.service().list(query);
    return sendSuccess(res, { items: result.items }, 200, { ...result.meta });
  });

  private service(): AuditService {
    if (!this.auditService) {
      throw new DatabaseError('Database is not configured');
    }

    return this.auditService;
  }
}
