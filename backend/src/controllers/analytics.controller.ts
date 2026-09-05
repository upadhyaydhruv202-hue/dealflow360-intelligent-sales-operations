import type { Request, Response } from 'express';

import { AuthenticationError, FeatureDisabledError } from '../errors';
import type { AnalyticsService } from '../integrations/analytics';
import {
  analyticsDashboardParamsSchema,
  analyticsDashboardQuerySchema,
  analyticsExportBodySchema,
  analyticsIngestBodySchema,
  analyticsQueryBodySchema,
} from '../integrations/analytics/analytics.schemas';
import { parseBody, parseParams } from '../schemas/parse';
import { asyncHandler } from '../utils/async-handler';
import { sendSuccess } from '../utils/response';

export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService | null) {}

  listKpis = asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const result = await this.service().listKpis({
      id: user.id,
      permissions: user.permissions,
    });
    return sendSuccess(res, result);
  });

  listDashboards = asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const result = await this.service().listDashboards({
      id: user.id,
      permissions: user.permissions,
    });
    return sendSuccess(res, result);
  });

  getDashboard = asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const params = parseParams(analyticsDashboardParamsSchema, req.params);
    const result = await this.service().getDashboard(params.name, {
      id: user.id,
      permissions: user.permissions,
    });
    return sendSuccess(res, result);
  });

  evaluateDashboard = asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const params = parseParams(analyticsDashboardParamsSchema, req.params);
    const body = parseBody(analyticsDashboardQuerySchema, req.body ?? {});
    const result = await this.service().evaluateDashboard({
      name: params.name,
      from: body.from,
      to: body.to,
      granularity: body.granularity,
      filters: body.filters?.map((filter) => ({
        field: filter.field,
        operator: filter.operator,
        value: filter.value ?? null,
      })),
      actor: { id: user.id, permissions: user.permissions },
    });
    return sendSuccess(res, result);
  });

  query = asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const body = parseBody(analyticsQueryBodySchema, req.body);
    const result = await this.service().query({
      kpi: body.kpi,
      kind: body.kind,
      from: body.from,
      to: body.to,
      granularity: body.granularity,
      groupBy: body.groupBy,
      filters: body.filters?.map((filter) => ({
        field: filter.field,
        operator: filter.operator,
        value: filter.value ?? null,
      })),
      page: body.page,
      pageSize: body.pageSize,
      actor: { id: user.id, permissions: user.permissions },
    });
    return sendSuccess(
      res,
      {
        provider: result.provider,
        kind: result.kind,
        kpi: result.kpi,
        aggregation: result.aggregation,
        unit: result.unit,
        from: result.from,
        to: result.to,
        granularity: result.granularity,
        groupBy: result.groupBy,
        snapshot: result.snapshot,
        points: result.points,
        rows: result.rows,
        pagination: result.meta,
      },
      200,
      result.meta,
    );
  });

  export = asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const body = parseBody(analyticsExportBodySchema, req.body);
    const result = await this.service().export({
      kpi: body.kpi,
      kind: body.kind,
      from: body.from,
      to: body.to,
      granularity: body.granularity,
      groupBy: body.groupBy,
      filters: body.filters?.map((filter) => ({
        field: filter.field,
        operator: filter.operator,
        value: filter.value ?? null,
      })),
      format: body.format,
      actor: { id: user.id, permissions: user.permissions },
    });
    return sendSuccess(res, {
      provider: result.provider,
      format: result.format,
      filename: result.filename,
      contentType: result.contentType,
      content: result.content,
      pagination: result.query.meta,
    });
  });

  ingest = asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const body = parseBody(analyticsIngestBodySchema, req.body);
    const result = await this.service().ingest(body.facts, {
      id: user.id,
      permissions: user.permissions,
    }, { viaHttp: true });
    return sendSuccess(res, result, 201);
  });

  private service(): AnalyticsService {
    if (!this.analyticsService) {
      throw new FeatureDisabledError('analytics');
    }
    return this.analyticsService;
  }
}

function requireUser(req: Request) {
  if (!req.user) {
    throw new AuthenticationError();
  }
  return req.user;
}
