import type { NextFunction, Request, RequestHandler, Response } from 'express';

export function composeHandlers(...handlers: RequestHandler[]): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    let index = 0;

    const run = (error?: unknown) => {
      if (error) {
        next(error);
        return;
      }

      const handler = handlers[index];
      index += 1;
      if (!handler) {
        next();
        return;
      }

      handler(req, res, run);
    };

    run();
  };
}
