import type { Request, Response } from 'express';

import { AuthenticationError } from '../errors';
import { generatePdfInputSchema } from '../integrations/pdf';
import type { PdfService } from '../integrations/pdf';
import type { StorageService } from '../integrations/storage';
import { requireEnabledService } from '../features';
import { parseBody } from '../schemas/parse';
import { asyncHandler } from '../utils/async-handler';
import { sendSuccess } from '../utils/response';

export class PdfController {
  constructor(
    private readonly pdf: PdfService | null,
    private readonly storage: StorageService | null,
  ) {}

  generate = asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const body = parseBody(generatePdfInputSchema, req.body);
    const result = await this.requirePdf().generate({ ...body, userId: user.id });
    if ('queued' in result) {
      return sendSuccess(res, result, 202);
    }

    const download = this.storage ? await this.storage.signDownload(result.key) : undefined;
    return sendSuccess(res, { ...result, download });
  });

  private requirePdf(): PdfService {
    return requireEnabledService(this.pdf, 'pdf');
  }
}

function requireUser(req: Request) {
  if (!req.user) {
    throw new AuthenticationError();
  }

  return req.user;
}
