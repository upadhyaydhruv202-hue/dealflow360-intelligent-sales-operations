import type { Request, Response } from 'express';

import { AuthenticationError, DatabaseError, ValidationError } from '../errors';
import type { DocumentIntelligenceService } from '../integrations/documents/document.service';
import { documentAnalyzeBodySchema, documentIdParamsSchema } from '../integrations/documents/document.schemas';
import { parseBody, parseParams } from '../schemas/parse';
import { asyncHandler } from '../utils/async-handler';
import { sendSuccess } from '../utils/response';

export class DocumentController {
  constructor(private readonly documents: DocumentIntelligenceService | null) {}

  analyze = asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const file = req.file;
    if (!file) {
      throw new ValidationError('Invalid uploaded file', [
        { path: 'file', message: 'A file is required', code: 'custom' },
      ]);
    }

    const body = parseBody(documentAnalyzeBodySchema, req.body);
    const result = await this.service().analyze({
      userId: user.id,
      file: {
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        buffer: file.buffer,
        fieldname: file.fieldname,
      },
      documentType: body.documentType,
      fields: body.fields,
      async: body.async,
    });

    return sendSuccess(res, result, result.status === 'processing' ? 202 : 200);
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const params = parseParams(documentIdParamsSchema, req.params);
    const result = await this.service().getResult(params.id, user.id);
    return sendSuccess(res, result);
  });

  private service(): DocumentIntelligenceService {
    if (!this.documents) {
      throw new DatabaseError('Document intelligence is not configured');
    }

    return this.documents;
  }
}

function requireUser(req: Request) {
  if (!req.user) {
    throw new AuthenticationError();
  }

  return req.user;
}
