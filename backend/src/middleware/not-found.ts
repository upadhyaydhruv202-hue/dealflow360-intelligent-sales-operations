import type { Request, Response } from 'express';

import { NotFoundError } from '../errors';

export function notFoundHandler(req: Request, _res: Response): void {
  throw new NotFoundError(`Route not found: ${req.method} ${req.path}`, {
    method: req.method,
    path: req.path,
  });
}
