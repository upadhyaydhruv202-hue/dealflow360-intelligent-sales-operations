import type { ProblemHost } from '../host';
import type { Actor } from './types';
import {
  applyRecommendationBodySchema,
  approvalParamSchema,
  billingParamSchema,
  createQuoteBodySchema,
  decideBodySchema,
  fulfillmentPlanBodySchema,
  idParamSchema,
  lineInputSchema,
  lineParamSchema,
  patchLineBodySchema,
  portalChangeBodySchema,
  tokenParamSchema,
} from './schemas';
import { toPortalView } from './portal-view';
import type { DealflowService } from './service';

function actorFrom(req: unknown): Actor {
  const user = (req as { user?: Actor }).user;
  if (!user?.id) {
    return { id: 'anonymous', role: 'user', permissions: [] };
  }
  return user;
}

export function createDealflowRouter(host: ProblemHost, service: DealflowService) {
  const http = host.http;
  if (!http) {
    throw new Error('DealFlow360 routes require host.http');
  }

  const router = http.Router();
  const read = [http.authenticate, http.requirePermission('dealflow.quotes.read')];
  const write = [http.authenticate, http.requirePermission('dealflow.quotes.write')];
  const approve = [http.authenticate, http.requirePermission('dealflow.quotes.approve')];
  const fulfill = [http.authenticate, http.requirePermission('dealflow.fulfillment.write')];
  const bill = [http.authenticate, http.requirePermission('dealflow.billing.write')];
  const catalog = [http.authenticate, http.requirePermission('dealflow.catalog.read')];

  router.get(
    '/',
    http.publicRateLimit,
    http.asyncHandler((_req, res) =>
      http.sendSuccess(res, {
        id: 'dealflow',
        title: 'DealFlow360',
        replaceable: false,
        jobName: 'dealflow.odoo.sync',
      }),
    ),
  );

  router.get(
    '/catalog',
    http.authenticatedRateLimit,
    ...catalog,
    http.asyncHandler(async (_req, res) => http.sendSuccess(res, await service.catalog())),
  );

  router.get(
    '/quotes',
    http.authenticatedRateLimit,
    ...read,
    http.asyncHandler(async (_req, res) => http.sendSuccess(res, await service.listQuotes())),
  );

  router.post(
    '/quotes',
    http.authenticatedRateLimit,
    ...write,
    http.asyncHandler(async (req, res) => {
      const body = http.parseBody(createQuoteBodySchema, req.body);
      return http.sendSuccess(res, await service.createQuote(body, actorFrom(req)), 201);
    }),
  );

  router.get(
    '/quotes/:id',
    http.authenticatedRateLimit,
    ...read,
    http.asyncHandler(async (req, res) => {
      const params = http.parseParams(idParamSchema, req.params);
      return http.sendSuccess(res, await service.getQuote(params.id));
    }),
  );

  router.post(
    '/quotes/:id/lines',
    http.authenticatedRateLimit,
    ...write,
    http.asyncHandler(async (req, res) => {
      const params = http.parseParams(idParamSchema, req.params);
      const body = http.parseBody(lineInputSchema, req.body);
      return http.sendSuccess(res, await service.addLine(params.id, body, actorFrom(req)));
    }),
  );

  router.patch(
    '/quotes/:id/lines/:lineId',
    http.authenticatedRateLimit,
    ...write,
    http.asyncHandler(async (req, res) => {
      const params = http.parseParams(lineParamSchema, req.params);
      const body = http.parseBody(patchLineBodySchema, req.body);
      return http.sendSuccess(res, await service.updateLine(params.id, params.lineId, body, actorFrom(req)));
    }),
  );

  router.delete(
    '/quotes/:id/lines/:lineId',
    http.authenticatedRateLimit,
    ...write,
    http.asyncHandler(async (req, res) => {
      const params = http.parseParams(lineParamSchema, req.params);
      return http.sendSuccess(res, await service.removeLine(params.id, params.lineId, actorFrom(req)));
    }),
  );

  router.post(
    '/quotes/:id/assess',
    http.authenticatedRateLimit,
    ...write,
    http.asyncHandler(async (req, res) => {
      const params = http.parseParams(idParamSchema, req.params);
      return http.sendSuccess(res, await service.assess(params.id));
    }),
  );

  router.post(
    '/quotes/:id/submit',
    http.authenticatedRateLimit,
    ...write,
    http.asyncHandler(async (req, res) => {
      const params = http.parseParams(idParamSchema, req.params);
      return http.sendSuccess(res, await service.submit(params.id, actorFrom(req)));
    }),
  );

  router.post(
    '/quotes/:id/approvals/:approvalId/decide',
    http.authenticatedRateLimit,
    ...approve,
    http.asyncHandler(async (req, res) => {
      const params = http.parseParams(approvalParamSchema, req.params);
      const body = http.parseBody(decideBodySchema, req.body);
      return http.sendSuccess(res, await service.decide(params.id, params.approvalId, body, actorFrom(req)));
    }),
  );

  router.post(
    '/quotes/:id/negotiate',
    http.authenticatedRateLimit,
    ...write,
    http.asyncHandler(async (req, res) => {
      const params = http.parseParams(idParamSchema, req.params);
      return http.sendSuccess(res, await service.startNegotiation(params.id, actorFrom(req)));
    }),
  );

  router.get(
    '/quotes/:id/recommendations',
    http.authenticatedRateLimit,
    ...read,
    http.asyncHandler(async (req, res) => {
      const params = http.parseParams(idParamSchema, req.params);
      return http.sendSuccess(res, await service.recommendations(params.id));
    }),
  );

  router.post(
    '/quotes/:id/recommendations',
    http.authenticatedRateLimit,
    ...write,
    http.asyncHandler(async (req, res) => {
      const params = http.parseParams(idParamSchema, req.params);
      const body = http.parseBody(applyRecommendationBodySchema, req.body);
      return http.sendSuccess(res, await service.applyRecommendation(params.id, body.relationId, actorFrom(req)));
    }),
  );

  router.post(
    '/quotes/:id/fulfillment/plan',
    http.authenticatedRateLimit,
    ...fulfill,
    http.asyncHandler(async (req, res) => {
      const params = http.parseParams(idParamSchema, req.params);
      const body = http.parseBody(fulfillmentPlanBodySchema, req.body ?? {});
      return http.sendSuccess(res, await service.planFulfillment(params.id, body.overrides, actorFrom(req)));
    }),
  );

  router.post(
    '/quotes/:id/billing/generate',
    http.authenticatedRateLimit,
    ...bill,
    http.asyncHandler(async (req, res) => {
      const params = http.parseParams(idParamSchema, req.params);
      return http.sendSuccess(res, await service.generateBilling(params.id, actorFrom(req)));
    }),
  );

  router.post(
    '/quotes/:id/billing/:scheduleId/cancel',
    http.authenticatedRateLimit,
    ...bill,
    http.asyncHandler(async (req, res) => {
      const params = http.parseParams(billingParamSchema, req.params);
      return http.sendSuccess(res, await service.cancelBilling(params.id, params.scheduleId, actorFrom(req)));
    }),
  );

  router.post(
    '/quotes/:id/confirm',
    http.authenticatedRateLimit,
    ...write,
    http.asyncHandler(async (req, res) => {
      const params = http.parseParams(idParamSchema, req.params);
      return http.sendSuccess(res, await service.confirm(params.id, actorFrom(req)));
    }),
  );

  router.post(
    '/quotes/:id/complete',
    http.authenticatedRateLimit,
    ...write,
    http.asyncHandler(async (req, res) => {
      const params = http.parseParams(idParamSchema, req.params);
      return http.sendSuccess(res, await service.complete(params.id, actorFrom(req)));
    }),
  );

  router.get(
    '/portal/:token',
    http.publicRateLimit,
    http.asyncHandler(async (req, res) => {
      const params = http.parseParams(tokenParamSchema, req.params);
      const quote = await service.getQuoteByToken(params.token);
      return http.sendSuccess(res, toPortalView(quote as Parameters<typeof toPortalView>[0]));
    }),
  );

  router.patch(
    '/portal/:token',
    http.publicRateLimit,
    http.asyncHandler(async (req, res) => {
      const params = http.parseParams(tokenParamSchema, req.params);
      const body = http.parseBody(portalChangeBodySchema, req.body);
      const quote = await service.applyPortalChange(params.token, body);
      return http.sendSuccess(res, toPortalView(quote as Parameters<typeof toPortalView>[0]));
    }),
  );

  return router;
}

export function createProblemManifestRouter(host: ProblemHost) {
  const http = host.http;
  if (!http) {
    throw new Error('DealFlow360 routes require host.http');
  }
  const router = http.Router();
  router.get(
    '/',
    http.publicRateLimit,
    http.asyncHandler((_req, res) =>
      http.sendSuccess(res, {
        id: 'dealflow',
        title: 'DealFlow360',
        replaceable: false,
        jobName: 'dealflow.odoo.sync',
      }),
    ),
  );
  return router;
}
