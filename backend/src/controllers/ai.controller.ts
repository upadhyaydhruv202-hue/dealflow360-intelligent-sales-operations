import type { Request, Response } from 'express';

import { ERROR_CODES } from '../constants';
import { ExternalServiceError } from '../errors';
import {
  AI_OUTPUT_SCHEMAS,
  type AIService,
  aiAnalyzeBodySchema,
  aiClassifyBodySchema,
  aiDraftBodySchema,
  aiExtractBodySchema,
  aiGenerateTextBodySchema,
  aiRecommendBodySchema,
  aiStructuredBodySchema,
  aiSummarizeBodySchema,
  aiEmbedBodySchema,
} from '../integrations/ai';
import { wrapUntrustedData } from '../integrations/ai/guardrails';
import { parseBody } from '../schemas/parse';
import { asyncHandler } from '../utils/async-handler';
import { sendError, sendSuccess } from '../utils/response';

export class AiController {
  constructor(private readonly ai: AIService | null) {}

  getHealth = asyncHandler(async (req: Request, res: Response) => {
    if (!this.ai) {
      return sendSuccess(res, {
        configured: false,
        healthy: true,
        skipped: true,
      });
    }

    const check = await this.ai.checkConnectivity();
    if (!check.healthy) {
      return sendError(res, {
        statusCode: 503,
        code: ERROR_CODES.NOT_READY,
        message: 'AI is unavailable',
        details: { check },
        requestId: req.requestId,
      });
    }

    return sendSuccess(res, check);
  });

  generateText = asyncHandler(async (req: Request, res: Response) => {
    const body = parseBody(aiGenerateTextBodySchema, req.body);
    const result = await this.service().generateText(body);
    return sendSuccess(res, result);
  });

  generateStructured = asyncHandler(async (req: Request, res: Response) => {
    const body = parseBody(aiStructuredBodySchema, req.body);
    if (body.schemaName === 'decision') {
      const result = await this.service().generateDecision({
        prompt: body.prompt,
        temperature: body.temperature,
        maxOutputTokens: body.maxOutputTokens,
      });
      return sendSuccess(res, result);
    }

    const result = await this.service().generateStructured({
      prompt: wrapUntrustedData('user', body.prompt),
      temperature: body.temperature,
      maxOutputTokens: body.maxOutputTokens,
      schema: AI_OUTPUT_SCHEMAS.insight,
      schemaName: 'insight',
    });
    return sendSuccess(res, result);
  });

  summarize = asyncHandler(async (req: Request, res: Response) => {
    const body = parseBody(aiSummarizeBodySchema, req.body);
    const result = await this.service().summarize(body);
    return sendSuccess(res, result);
  });

  classify = asyncHandler(async (req: Request, res: Response) => {
    const body = parseBody(aiClassifyBodySchema, req.body);
    const result = await this.service().classify(body);
    return sendSuccess(res, result);
  });

  extract = asyncHandler(async (req: Request, res: Response) => {
    const body = parseBody(aiExtractBodySchema, req.body);
    const result = await this.service().extract(body);
    return sendSuccess(res, result);
  });

  analyze = asyncHandler(async (req: Request, res: Response) => {
    const body = parseBody(aiAnalyzeBodySchema, req.body);
    const result = await this.service().analyze(body);
    return sendSuccess(res, result);
  });

  recommend = asyncHandler(async (req: Request, res: Response) => {
    const body = parseBody(aiRecommendBodySchema, req.body);
    const result = await this.service().recommend(body);
    return sendSuccess(res, result);
  });

  draft = asyncHandler(async (req: Request, res: Response) => {
    const body = parseBody(aiDraftBodySchema, req.body);
    const result = await this.service().draft(body);
    return sendSuccess(res, result);
  });

  embed = asyncHandler(async (req: Request, res: Response) => {
    const body = parseBody(aiEmbedBodySchema, req.body);
    const result = await this.service().embed(body);
    return sendSuccess(res, result);
  });

  private service(): AIService {
    if (!this.ai) {
      throw new ExternalServiceError('AI is not configured', { provider: 'ai' });
    }

    return this.ai;
  }
}
