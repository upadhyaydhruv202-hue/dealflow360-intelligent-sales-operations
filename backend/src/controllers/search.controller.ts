import type { Request, Response } from 'express';

import { AuthenticationError, FeatureDisabledError } from '../errors';
import type { SearchService } from '../integrations/search';
import {
  searchBodySchema,
  searchDocumentParamsSchema,
  searchIndexBodySchema,
} from '../integrations/search/search.schemas';
import { parseBody, parseParams } from '../schemas/parse';
import { asyncHandler } from '../utils/async-handler';
import { sendSuccess } from '../utils/response';

export class SearchController {
  constructor(private readonly searchService: SearchService | null) {}

  listIndexes = asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const result = await this.service().listIndexes({
      id: user.id,
      permissions: user.permissions,
    });
    return sendSuccess(res, result);
  });

  search = asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const body = parseBody(searchBodySchema, req.body);
    const result = await this.service().search({
      query: body.query,
      index: body.index,
      mode: body.mode,
      filters: body.filters?.map((filter) => ({
        field: filter.field,
        operator: filter.operator,
        value: filter.value ?? null,
      })),
      sort: body.sort,
      page: body.page,
      pageSize: body.pageSize,
      highlight: body.highlight,
      actor: { id: user.id, permissions: user.permissions },
    });
    return sendSuccess(res, {
      provider: result.provider,
      mode: result.mode,
      fallbackFrom: result.fallbackFrom,
      query: result.query,
      indexes: result.indexes,
      hits: result.hits,
      pagination: result.meta,
    }, 200, result.meta);
  });

  index = asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const body = parseBody(searchIndexBodySchema, req.body);
    const result = await this.service().index(body, {
      id: user.id,
      permissions: user.permissions,
    });
    return sendSuccess(res, result, 201);
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const params = parseParams(searchDocumentParamsSchema, req.params);
    const result = await this.service().delete(params, {
      id: user.id,
      permissions: user.permissions,
    });
    return sendSuccess(res, result);
  });

  private service(): SearchService {
    if (!this.searchService) {
      throw new FeatureDisabledError('search');
    }
    return this.searchService;
  }
}

function requireUser(req: Request) {
  if (!req.user) {
    throw new AuthenticationError();
  }
  return req.user;
}
