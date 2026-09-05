import type { Request, Response } from 'express';

import { AuthenticationError } from '../errors';
import type { IntentService } from '../intents';
import { intentExecuteBodySchema } from '../intents/intents.schemas';
import { requireEnabledService } from '../features';
import { parseBody } from '../schemas/parse';
import { asyncHandler } from '../utils/async-handler';
import { sendSuccess } from '../utils/response';

export class IntentsController {
  constructor(private readonly intents: IntentService | null) {}

  list = asyncHandler(async (req: Request, res: Response) => {
    requireUser(req);
    return sendSuccess(res, { intents: this.service().listIntents() });
  });

  execute = asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const body = parseBody(intentExecuteBodySchema, req.body);
    const result = await this.service().execute({
      user,
      utterance: body.utterance,
      confirm: body.confirm,
      confirmationToken: body.confirmationToken,
    });
    return sendSuccess(res, result);
  });

  private service(): IntentService {
    return requireEnabledService(this.intents, 'intents');
  }
}

function requireUser(req: Request) {
  if (!req.user) {
    throw new AuthenticationError();
  }

  return req.user;
}
