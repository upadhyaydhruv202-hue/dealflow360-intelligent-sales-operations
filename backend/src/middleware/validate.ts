import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodTypeAny } from 'zod';

import { parseBody, parseHeaders, parseParams, parseQuery } from '../schemas/parse';

export interface RequestSchemas {
  body?: ZodTypeAny;
  params?: ZodTypeAny;
  query?: ZodTypeAny;
  headers?: ZodTypeAny;
}

export function validate(schemas: RequestSchemas): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (schemas.body) {
        req.body = parseBody(schemas.body, req.body);
      }

      if (schemas.params) {
        req.params = parseParams(schemas.params, req.params) as Request['params'];
      }

      if (schemas.query) {
        req.query = parseQuery(schemas.query, req.query) as Request['query'];
      }

      if (schemas.headers) {
        parseHeaders(schemas.headers, req.headers);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
