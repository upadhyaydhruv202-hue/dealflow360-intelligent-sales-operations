import type { Request, Response } from 'express';

import { AuthenticationError, FeatureDisabledError } from '../errors';
import { parseQuery } from '../schemas/parse';
import { asyncHandler } from '../utils/async-handler';
import { sendSuccess } from '../utils/response';
import type { RealtimeService } from '../realtime';
import { realtimeChannelsQuerySchema } from '../realtime';

export class RealtimeController {
  constructor(private readonly realtime: RealtimeService | null) {}

  listChannels = asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    return sendSuccess(res, this.service().listChannels(user));
  });

  events = asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const query = parseQuery(realtimeChannelsQuerySchema, req.query);
    await this.service().connect(user, res, query.channels);
  });

  private service(): RealtimeService {
    if (!this.realtime) {
      throw new FeatureDisabledError('realtime');
    }
    return this.realtime;
  }
}

function requireUser(req: Request) {
  if (!req.user) {
    throw new AuthenticationError();
  }
  return req.user;
}
