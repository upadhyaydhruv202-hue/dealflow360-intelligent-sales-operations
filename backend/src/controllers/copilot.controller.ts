import type { Request, Response } from 'express';

import { AuthenticationError } from '../errors';
import type { CopilotService } from '../copilot';
import {
  copilotChatBodySchema,
  copilotConversationListQuerySchema,
  copilotConversationParamsSchema,
} from '../copilot/copilot.schemas';
import { requireEnabledService } from '../features';
import { parseBody, parseParams, parseQuery } from '../schemas/parse';
import { asyncHandler } from '../utils/async-handler';
import { sendSuccess } from '../utils/response';

export class CopilotController {
  constructor(private readonly copilot: CopilotService | null) {}

  listTools = asyncHandler(async (req: Request, res: Response) => {
    requireUser(req);
    return sendSuccess(res, { tools: this.service().listTools() });
  });

  chat = asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const body = parseBody(copilotChatBodySchema, req.body);
    const result = await this.service().chat({
      user,
      message: body.message,
      conversationId: body.conversationId,
      confirm: body.confirm,
    });
    return sendSuccess(res, result);
  });

  listConversations = asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const query = parseQuery(copilotConversationListQuerySchema, req.query);
    const result = await this.service().listConversations(user.id, query);
    return sendSuccess(res, { items: result.items }, 200, { ...result.meta });
  });

  getConversation = asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const params = parseParams(copilotConversationParamsSchema, req.params);
    const conversation = await this.service().getConversation(params.id, user.id);
    return sendSuccess(res, conversation);
  });

  clearConversation = asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const params = parseParams(copilotConversationParamsSchema, req.params);
    const result = await this.service().clearConversation(params.id, user.id);
    return sendSuccess(res, result);
  });

  deleteConversation = asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const params = parseParams(copilotConversationParamsSchema, req.params);
    const result = await this.service().deleteConversation(params.id, user.id);
    return sendSuccess(res, result);
  });

  private service(): CopilotService {
    return requireEnabledService(this.copilot, 'copilot');
  }
}

function requireUser(req: Request) {
  if (!req.user) {
    throw new AuthenticationError();
  }

  return req.user;
}
