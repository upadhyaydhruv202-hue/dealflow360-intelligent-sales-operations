import type { Request, Response } from 'express';

import { AuthenticationError, FeatureDisabledError } from '../errors';
import type { RagService } from '../integrations/rag';
import {
  ragAskBodySchema,
  ragDocumentParamsSchema,
  ragIndexBodySchema,
  ragSearchBodySchema,
} from '../integrations/rag/rag.schemas';
import { parseBody, parseParams } from '../schemas/parse';
import { asyncHandler } from '../utils/async-handler';
import { sendSuccess } from '../utils/response';

export class RagController {
  constructor(private readonly rag: RagService | null) {}

  index = asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const body = parseBody(ragIndexBodySchema, req.body);
    const result = await this.service().index({
      ...body,
      userId: user.id,
    });
    return sendSuccess(res, result, result.status === 'processing' ? 202 : 201);
  });

  getDocument = asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const params = parseParams(ragDocumentParamsSchema, req.params);
    const document = await this.service().getDocument(params.id, user.id);
    return sendSuccess(res, document);
  });

  deleteDocument = asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const params = parseParams(ragDocumentParamsSchema, req.params);
    const result = await this.service().deleteDocument(params.id, user.id);
    return sendSuccess(res, result);
  });

  search = asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const body = parseBody(ragSearchBodySchema, req.body);
    const result = await this.service().search({ ...body, userId: user.id });
    return sendSuccess(res, result);
  });

  ask = asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const body = parseBody(ragAskBodySchema, req.body);
    const result = await this.service().ask({ ...body, userId: user.id });
    return sendSuccess(res, result);
  });

  private service(): RagService {
    if (!this.rag) {
      throw new FeatureDisabledError('rag');
    }

    return this.rag;
  }
}

function requireUser(req: Request) {
  if (!req.user) {
    throw new AuthenticationError();
  }

  return req.user;
}
