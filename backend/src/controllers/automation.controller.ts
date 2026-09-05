import type { Request, Response } from 'express';

import { AuthenticationError } from '../errors';
import type { AutomationService } from '../automation';
import {
  createAutomationRuleBodySchema,
  emitAutomationEventBodySchema,
  automationExecutionListQuerySchema,
  automationRuleListQuerySchema,
  automationRuleParamsSchema,
  automationWebhookBodySchema,
  updateAutomationRuleBodySchema,
} from '../automation/automation.schemas';
import { parseBody, parseParams, parseQuery } from '../schemas/parse';
import { requireEnabledService } from '../features';
import { asyncHandler } from '../utils/async-handler';
import { sendSuccess } from '../utils/response';

export class AutomationController {
  constructor(private readonly automation: AutomationService | null) {}

  catalog = asyncHandler(async (req: Request, res: Response) => {
    requireUser(req);
    return sendSuccess(res, this.service().catalog());
  });

  listRules = asyncHandler(async (req: Request, res: Response) => {
    requireUser(req);
    const query = parseQuery(automationRuleListQuerySchema, req.query);
    const result = await this.service().listRules(query);
    return sendSuccess(res, { items: result.items }, 200, { ...result.meta });
  });

  getRule = asyncHandler(async (req: Request, res: Response) => {
    requireUser(req);
    const params = parseParams(automationRuleParamsSchema, req.params);
    const rule = await this.service().getRule(params.id);
    return sendSuccess(res, rule);
  });

  createRule = asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const body = parseBody(createAutomationRuleBodySchema, req.body);
    const rule = await this.service().createRule(body, user);
    return sendSuccess(res, rule, 201);
  });

  updateRule = asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const params = parseParams(automationRuleParamsSchema, req.params);
    const body = parseBody(updateAutomationRuleBodySchema, req.body);
    const rule = await this.service().updateRule(params.id, body, user);
    return sendSuccess(res, rule);
  });

  validateRule = asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const params = parseParams(automationRuleParamsSchema, req.params);
    const rule = await this.service().validateRule(params.id, user);
    return sendSuccess(res, rule);
  });

  enableRule = asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const params = parseParams(automationRuleParamsSchema, req.params);
    const rule = await this.service().enableRule(params.id, user);
    return sendSuccess(res, rule);
  });

  disableRule = asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const params = parseParams(automationRuleParamsSchema, req.params);
    const rule = await this.service().disableRule(params.id, user);
    return sendSuccess(res, rule);
  });

  listExecutions = asyncHandler(async (req: Request, res: Response) => {
    requireUser(req);
    const query = parseQuery(automationExecutionListQuerySchema, req.query);
    const result = await this.service().listExecutions(query);
    return sendSuccess(res, { items: result.items }, 200, { ...result.meta });
  });

  getExecution = asyncHandler(async (req: Request, res: Response) => {
    requireUser(req);
    const params = parseParams(automationRuleParamsSchema, req.params);
    const execution = await this.service().getExecution(params.id);
    return sendSuccess(res, execution);
  });

  emitEvent = asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const body = parseBody(emitAutomationEventBodySchema, req.body);
    const event = await this.service().emitEvent(body, user);
    return sendSuccess(res, event, 202);
  });

  receiveWebhook = asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const body = parseBody(automationWebhookBodySchema, req.body);
    const event = await this.service().emitEvent(
      {
        trigger: 'webhook.received',
        eventId: body.eventId,
        payload: body.payload,
      },
      user,
    );
    return sendSuccess(res, event, 202);
  });

  private service(): AutomationService {
    return requireEnabledService(this.automation, 'automation');
  }
}

function requireUser(req: Request) {
  if (!req.user) {
    throw new AuthenticationError();
  }
  return req.user;
}
