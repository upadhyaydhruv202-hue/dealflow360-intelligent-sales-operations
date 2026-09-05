import type { Request, Response } from 'express';

import { AuthenticationError } from '../errors';
import { generateReportBodySchema, isQueuedReport, type ReportService } from '../integrations/reports';
import type { StorageService } from '../integrations/storage';
import { requireEnabledService } from '../features';
import { parseBody } from '../schemas/parse';
import { asyncHandler } from '../utils/async-handler';
import { sendSuccess } from '../utils/response';

export class ReportController {
  constructor(
    private readonly reports: ReportService | null,
    private readonly storage: StorageService | null,
  ) {}

  listTypes = asyncHandler(async (req: Request, res: Response) => {
    requireUser(req);
    return sendSuccess(res, { types: this.requireReports().listTypes() });
  });

  generate = asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const body = parseBody(generateReportBodySchema, req.body);
    const result = await this.requireReports().generateReport({
      ...body,
      userId: user.id,
    });

    if (isQueuedReport(result)) {
      return sendSuccess(res, { jobId: result.jobId, status: result.status }, 202);
    }

    const download = this.storage ? await this.storage.signDownload(result.key) : undefined;
    return sendSuccess(res, { ...result, download });
  });

  private requireReports(): ReportService {
    return requireEnabledService(this.reports, 'pdf');
  }
}

function requireUser(req: Request) {
  if (!req.user) {
    throw new AuthenticationError();
  }

  return req.user;
}
