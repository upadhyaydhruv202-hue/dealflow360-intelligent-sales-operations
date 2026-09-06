import type { ProblemHost } from '../host';
import type { Actor } from './types';
import {
  addLineBodySchema,
  anomalyDispositionBodySchema,
  anomalyParamSchema,
  applyRecommendationBodySchema,
  approvalParamSchema,
  billingParamSchema,
  chainBodySchema,
  chainPatchBodySchema,
  createQuoteBodySchema,
  decideBodySchema,
  expectedVersionSchema,
  fulfillmentPlanBodySchema,
  idParamSchema,
  lineParamSchema,
  managerReviseBodySchema,
  negotiationBodySchema,
  negotiationParamSchema,
  respondNegotiationBodySchema,
  patchGovernanceBodySchema,
  patchLineBodySchema,
  policyBodySchema,
  policyPatchBodySchema,
  portalChangeBodySchema,
  portalDecisionBodySchema,
  portalNegotiationBodySchema,
  productBodySchema,
  productPatchBodySchema,
  customerBodySchema,
  customerPatchBodySchema,
  relationBodySchema,
  relationPatchBodySchema,
  replaceQuantityBreaksBodySchema,
  replaceRoleAuthoritiesBodySchema,
  stockBodySchema,
  stockKeySchema,
  warehouseBodySchema,
  warehousePatchBodySchema,
  tokenParamSchema,
  vendorContactBodySchema,
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
  const catalogWrite = [http.authenticate, http.requirePermission('dealflow.catalog.write')];
  const catalogProductWrite = [http.authenticate, http.requirePermission('dealflow.catalog.products.write')];
  const lock = [http.authenticate, http.requirePermission('dealflow.quotes.lock')];

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

  router.put(
    '/catalog/quantity-breaks',
    http.authenticatedRateLimit,
    ...catalogWrite,
    http.asyncHandler(async (req, res) => {
      const body = http.parseBody(replaceQuantityBreaksBodySchema, req.body);
      const items = body.items.map((item) => ({
        ...item,
        id: item.id ?? crypto.randomUUID(),
      }));
      return http.sendSuccess(res, await service.replaceQuantityBreaks(items, actorFrom(req)));
    }),
  );

  router.put(
    '/catalog/role-authorities',
    http.authenticatedRateLimit,
    ...catalogWrite,
    http.asyncHandler(async (req, res) => {
      const body = http.parseBody(replaceRoleAuthoritiesBodySchema, req.body);
      return http.sendSuccess(res, await service.replaceRoleAuthorities(body.items, actorFrom(req)));
    }),
  );

  router.patch(
    '/catalog/governance',
    http.authenticatedRateLimit,
    ...catalogWrite,
    http.asyncHandler(async (req, res) => {
      const body = http.parseBody(patchGovernanceBodySchema, req.body);
      return http.sendSuccess(res, await service.updateGovernance(body, actorFrom(req)));
    }),
  );

  router.post(
    '/catalog/products',
    http.authenticatedRateLimit,
    ...catalogProductWrite,
    http.asyncHandler(async (req, res) => {
      const body = http.parseBody(productBodySchema, req.body);
      return http.sendSuccess(res, await service.upsertProduct(body, actorFrom(req)), 201);
    }),
  );

  router.patch(
    '/catalog/products',
    http.authenticatedRateLimit,
    ...catalogProductWrite,
    http.asyncHandler(async (req, res) => {
      const body = http.parseBody(productPatchBodySchema, req.body);
      return http.sendSuccess(res, await service.upsertProduct(body as Parameters<DealflowService['upsertProduct']>[0], actorFrom(req)));
    }),
  );

  router.delete(
    '/catalog/products/:id',
    http.authenticatedRateLimit,
    ...catalogProductWrite,
    http.asyncHandler(async (req, res) => {
      const params = http.parseParams(idParamSchema, req.params);
      return http.sendSuccess(res, await service.deleteProduct(params.id, actorFrom(req)));
    }),
  );

  router.post(
    '/catalog/customers',
    http.authenticatedRateLimit,
    ...write,
    http.asyncHandler(async (req, res) => {
      const body = http.parseBody(customerBodySchema, req.body);
      return http.sendSuccess(res, await service.upsertCustomer(body, actorFrom(req)), 201);
    }),
  );

  router.patch(
    '/catalog/customers',
    http.authenticatedRateLimit,
    ...write,
    http.asyncHandler(async (req, res) => {
      const body = http.parseBody(customerPatchBodySchema, req.body);
      return http.sendSuccess(res, await service.upsertCustomer(body, actorFrom(req)));
    }),
  );

  router.delete(
    '/catalog/customers/:id',
    http.authenticatedRateLimit,
    ...write,
    http.asyncHandler(async (req, res) => {
      const params = http.parseParams(idParamSchema, req.params);
      return http.sendSuccess(res, await service.deleteCustomer(params.id, actorFrom(req)));
    }),
  );

  router.post(
    '/catalog/warehouses',
    http.authenticatedRateLimit,
    ...catalogWrite,
    http.asyncHandler(async (req, res) => {
      const body = http.parseBody(warehouseBodySchema, req.body);
      return http.sendSuccess(res, await service.upsertWarehouse(body, actorFrom(req)), 201);
    }),
  );

  router.patch(
    '/catalog/warehouses',
    http.authenticatedRateLimit,
    ...catalogWrite,
    http.asyncHandler(async (req, res) => {
      const body = http.parseBody(warehousePatchBodySchema, req.body);
      return http.sendSuccess(res, await service.upsertWarehouse(body, actorFrom(req)));
    }),
  );

  router.post(
    '/catalog/relations',
    http.authenticatedRateLimit,
    ...catalogWrite,
    http.asyncHandler(async (req, res) => {
      const body = http.parseBody(relationBodySchema, req.body);
      return http.sendSuccess(res, await service.upsertRelation(body, actorFrom(req)), 201);
    }),
  );

  router.patch(
    '/catalog/relations',
    http.authenticatedRateLimit,
    ...catalogWrite,
    http.asyncHandler(async (req, res) => {
      const body = http.parseBody(relationPatchBodySchema, req.body);
      return http.sendSuccess(res, await service.upsertRelation(body, actorFrom(req)));
    }),
  );

  router.delete(
    '/catalog/relations/:id',
    http.authenticatedRateLimit,
    ...catalogWrite,
    http.asyncHandler(async (req, res) => {
      const params = http.parseParams(idParamSchema, req.params);
      return http.sendSuccess(res, await service.deleteRelation(params.id, actorFrom(req)));
    }),
  );

  router.put(
    '/catalog/stock',
    http.authenticatedRateLimit,
    ...catalogProductWrite,
    http.asyncHandler(async (req, res) => {
      const body = http.parseBody(stockBodySchema, req.body);
      return http.sendSuccess(
        res,
        await service.upsertStock(
          { ...body, reserved: body.reserved ?? 0, incoming: body.incoming ?? 0 },
          actorFrom(req),
        ),
      );
    }),
  );

  router.delete(
    '/catalog/stock/:warehouseId/:productId',
    http.authenticatedRateLimit,
    ...catalogProductWrite,
    http.asyncHandler(async (req, res) => {
      const params = http.parseParams(stockKeySchema, req.params);
      return http.sendSuccess(res, await service.deleteStock(params.warehouseId, params.productId, actorFrom(req)));
    }),
  );

  router.post(
    '/catalog/policies',
    http.authenticatedRateLimit,
    ...catalogWrite,
    http.asyncHandler(async (req, res) => {
      const body = http.parseBody(policyBodySchema, req.body);
      return http.sendSuccess(res, await service.upsertPolicy(body, actorFrom(req)), 201);
    }),
  );

  router.patch(
    '/catalog/policies',
    http.authenticatedRateLimit,
    ...catalogWrite,
    http.asyncHandler(async (req, res) => {
      const body = http.parseBody(policyPatchBodySchema, req.body);
      return http.sendSuccess(res, await service.upsertPolicy(body, actorFrom(req)));
    }),
  );

  router.delete(
    '/catalog/policies/:id',
    http.authenticatedRateLimit,
    ...catalogWrite,
    http.asyncHandler(async (req, res) => {
      const params = http.parseParams(idParamSchema, req.params);
      return http.sendSuccess(res, await service.deletePolicy(params.id, actorFrom(req)));
    }),
  );

  router.post(
    '/catalog/chains',
    http.authenticatedRateLimit,
    ...catalogWrite,
    http.asyncHandler(async (req, res) => {
      const body = http.parseBody(chainBodySchema, req.body);
      return http.sendSuccess(
        res,
        await service.upsertChain(
          {
            ...body,
            steps: body.steps.map((step) => ({
              id: step.id ?? crypto.randomUUID(),
              chainId: step.chainId ?? body.id ?? '',
              stepOrder: step.stepOrder,
              roleKey: step.roleKey,
              label: step.label,
            })),
          },
          actorFrom(req),
        ),
        201,
      );
    }),
  );

  router.patch(
    '/catalog/chains',
    http.authenticatedRateLimit,
    ...catalogWrite,
    http.asyncHandler(async (req, res) => {
      const body = http.parseBody(chainPatchBodySchema, req.body);
      return http.sendSuccess(
        res,
        await service.upsertChain(
          {
            ...body,
            steps: body.steps.map((step) => ({
              id: step.id ?? crypto.randomUUID(),
              chainId: body.id,
              stepOrder: step.stepOrder,
              roleKey: step.roleKey,
              label: step.label,
            })),
          },
          actorFrom(req),
        ),
      );
    }),
  );

  router.delete(
    '/catalog/chains/:id',
    http.authenticatedRateLimit,
    ...catalogWrite,
    http.asyncHandler(async (req, res) => {
      const params = http.parseParams(idParamSchema, req.params);
      return http.sendSuccess(res, await service.deleteChain(params.id, actorFrom(req)));
    }),
  );

  router.delete(
    '/catalog/warehouses/:id',
    http.authenticatedRateLimit,
    ...catalogWrite,
    http.asyncHandler(async (req, res) => {
      const params = http.parseParams(idParamSchema, req.params);
      return http.sendSuccess(res, await service.deleteWarehouse(params.id, actorFrom(req)));
    }),
  );

  router.get(
    '/me/quotes',
    http.authenticatedRateLimit,
    http.authenticate,
    http.asyncHandler(async (req, res) => http.sendSuccess(res, await service.listMyQuotes(actorFrom(req)))),
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

  router.delete(
    '/quotes/:id',
    http.authenticatedRateLimit,
    ...write,
    http.asyncHandler(async (req, res) => {
      const params = http.parseParams(idParamSchema, req.params);
      const body = http.parseBody(expectedVersionSchema, req.body ?? {});
      return http.sendSuccess(res, await service.deleteQuote(params.id, actorFrom(req), body.expectedVersion));
    }),
  );

  router.post(
    '/quotes/:id/void',
    http.authenticatedRateLimit,
    ...write,
    http.asyncHandler(async (req, res) => {
      const params = http.parseParams(idParamSchema, req.params);
      const body = http.parseBody(expectedVersionSchema, req.body ?? {});
      return http.sendSuccess(res, await service.voidQuote(params.id, actorFrom(req), body.expectedVersion));
    }),
  );

  router.get(
    '/quotes/:id',
    http.authenticatedRateLimit,
    ...read,
    http.asyncHandler(async (req, res) => {
      const params = http.parseParams(idParamSchema, req.params);
      return http.sendSuccess(res, await service.getQuote(params.id, actorFrom(req)));
    }),
  );

  router.post(
    '/quotes/:id/lines',
    http.authenticatedRateLimit,
    ...write,
    http.asyncHandler(async (req, res) => {
      const params = http.parseParams(idParamSchema, req.params);
      const body = http.parseBody(addLineBodySchema, req.body);
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
      const body = http.parseBody(expectedVersionSchema, req.body ?? {});
      return http.sendSuccess(res, await service.removeLine(params.id, params.lineId, body, actorFrom(req)));
    }),
  );

  router.post(
    '/quotes/:id/assess',
    http.authenticatedRateLimit,
    ...write,
    http.asyncHandler(async (req, res) => {
      const params = http.parseParams(idParamSchema, req.params);
      return http.sendSuccess(res, await service.assess(params.id, actorFrom(req)));
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
    '/quotes/:id/negotiations',
    http.authenticatedRateLimit,
    ...read,
    http.asyncHandler(async (req, res) => {
      const params = http.parseParams(idParamSchema, req.params);
      return http.sendSuccess(res, await service.listNegotiationRequests(params.id, actorFrom(req)));
    }),
  );

  router.post(
    '/quotes/:id/negotiations',
    http.authenticatedRateLimit,
    http.authenticate,
    http.asyncHandler(async (req, res) => {
      const params = http.parseParams(idParamSchema, req.params);
      const body = http.parseBody(negotiationBodySchema, req.body);
      return http.sendSuccess(res, await service.createNegotiationRequest(params.id, body, actorFrom(req)), 201);
    }),
  );

  router.post(
    '/quotes/:id/negotiations/:nid/respond',
    http.authenticatedRateLimit,
    ...write,
    http.asyncHandler(async (req, res) => {
      const params = http.parseParams(negotiationParamSchema, req.params);
      const body = http.parseBody(respondNegotiationBodySchema, req.body);
      return http.sendSuccess(
        res,
        await service.respondToNegotiation(params.id, params.nid, body, actorFrom(req)),
      );
    }),
  );

  router.post(
    '/quotes/:id/negotiations/:nid/send-to-manager',
    http.authenticatedRateLimit,
    ...write,
    http.asyncHandler(async (req, res) => {
      const params = http.parseParams(negotiationParamSchema, req.params);
      const body = http.parseBody(expectedVersionSchema, req.body ?? {});
      return http.sendSuccess(
        res,
        await service.sendNegotiationToManager(params.id, params.nid, actorFrom(req), body.expectedVersion),
      );
    }),
  );

  router.post(
    '/quotes/:id/send-to-manager',
    http.authenticatedRateLimit,
    ...write,
    http.asyncHandler(async (req, res) => {
      const params = http.parseParams(idParamSchema, req.params);
      const body = http.parseBody(expectedVersionSchema, req.body ?? {});
      return http.sendSuccess(
        res,
        await service.sendNegotiationToManager(params.id, undefined, actorFrom(req), body.expectedVersion),
      );
    }),
  );

  router.post(
    '/quotes/:id/revise',
    http.authenticatedRateLimit,
    ...write,
    http.asyncHandler(async (req, res) => {
      const params = http.parseParams(idParamSchema, req.params);
      const body = http.parseBody(managerReviseBodySchema, req.body);
      return http.sendSuccess(res, await service.reviseAsManager(params.id, body, actorFrom(req)));
    }),
  );

  router.post(
    '/quotes/:id/return',
    http.authenticatedRateLimit,
    ...write,
    http.asyncHandler(async (req, res) => {
      const params = http.parseParams(idParamSchema, req.params);
      const body = http.parseBody(expectedVersionSchema, req.body ?? {});
      return http.sendSuccess(
        res,
        await service.returnRevisedQuote(params.id, undefined, actorFrom(req), body.expectedVersion),
      );
    }),
  );

  router.post(
    '/quotes/:id/negotiations/:nid/return',
    http.authenticatedRateLimit,
    ...write,
    http.asyncHandler(async (req, res) => {
      const params = http.parseParams(negotiationParamSchema, req.params);
      const body = http.parseBody(expectedVersionSchema, req.body ?? {});
      return http.sendSuccess(
        res,
        await service.returnRevisedQuote(params.id, params.nid, actorFrom(req), body.expectedVersion),
      );
    }),
  );

  router.post(
    '/quotes/:id/agree',
    http.authenticatedRateLimit,
    http.authenticate,
    http.asyncHandler(async (req, res) => {
      const params = http.parseParams(idParamSchema, req.params);
      const body = http.parseBody(expectedVersionSchema, req.body ?? {});
      return http.sendSuccess(res, await service.agreeToFinal(params.id, body, actorFrom(req)));
    }),
  );

  router.post(
    '/quotes/:id/finalize',
    http.authenticatedRateLimit,
    ...write,
    http.asyncHandler(async (req, res) => {
      const params = http.parseParams(idParamSchema, req.params);
      const body = http.parseBody(expectedVersionSchema, req.body ?? {});
      return http.sendSuccess(res, await service.finalizeQuotation(params.id, actorFrom(req), body.expectedVersion));
    }),
  );

  router.post(
    '/quotes/:id/lock',
    http.authenticatedRateLimit,
    ...lock,
    http.asyncHandler(async (req, res) => {
      const params = http.parseParams(idParamSchema, req.params);
      const body = http.parseBody(expectedVersionSchema, req.body ?? {});
      return http.sendSuccess(res, await service.lockDeal(params.id, actorFrom(req), body.expectedVersion));
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
      return http.sendSuccess(
        res,
        await service.applyRecommendation(params.id, body.relationId, actorFrom(req), body.expectedVersion),
      );
    }),
  );

  router.post(
    '/quotes/:id/fulfillment/plan',
    http.authenticatedRateLimit,
    ...fulfill,
    http.asyncHandler(async (req, res) => {
      const params = http.parseParams(idParamSchema, req.params);
      const body = http.parseBody(fulfillmentPlanBodySchema, req.body ?? {});
      return http.sendSuccess(
        res,
        await service.planFulfillment(params.id, body.overrides, actorFrom(req), body.expectedVersion),
      );
    }),
  );

  router.post(
    '/quotes/:id/billing/generate',
    http.authenticatedRateLimit,
    ...bill,
    http.asyncHandler(async (req, res) => {
      const params = http.parseParams(idParamSchema, req.params);
      const body = http.parseBody(expectedVersionSchema, req.body ?? {});
      return http.sendSuccess(res, await service.generateBilling(params.id, actorFrom(req), body.expectedVersion));
    }),
  );

  router.post(
    '/quotes/:id/billing/:scheduleId/cancel',
    http.authenticatedRateLimit,
    ...bill,
    http.asyncHandler(async (req, res) => {
      const params = http.parseParams(billingParamSchema, req.params);
      const body = http.parseBody(expectedVersionSchema, req.body ?? {});
      return http.sendSuccess(
        res,
        await service.cancelBilling(params.id, params.scheduleId, actorFrom(req), body.expectedVersion),
      );
    }),
  );

  router.post(
    '/quotes/:id/confirm',
    http.authenticatedRateLimit,
    ...lock,
    http.asyncHandler(async (req, res) => {
      const params = http.parseParams(idParamSchema, req.params);
      const body = http.parseBody(expectedVersionSchema, req.body ?? {});
      return http.sendSuccess(res, await service.lockDeal(params.id, actorFrom(req), body.expectedVersion));
    }),
  );

  router.post(
    '/quotes/:id/vendor-contact',
    http.authenticatedRateLimit,
    ...write,
    http.asyncHandler(async (req, res) => {
      const params = http.parseParams(idParamSchema, req.params);
      const body = http.parseBody(vendorContactBodySchema, req.body);
      return http.sendSuccess(res, await service.contactVendor(params.id, body, actorFrom(req)));
    }),
  );

  router.post(
    '/quotes/:id/complete',
    http.authenticatedRateLimit,
    ...write,
    http.asyncHandler(async (req, res) => {
      const params = http.parseParams(idParamSchema, req.params);
      const body = http.parseBody(expectedVersionSchema, req.body ?? {});
      return http.sendSuccess(res, await service.complete(params.id, actorFrom(req), body.expectedVersion));
    }),
  );

  router.get(
    '/quotes/:id/pdf',
    http.authenticatedRateLimit,
    ...read,
    http.asyncHandler(async (req, res) => {
      const params = http.parseParams(idParamSchema, req.params);
      const pdf = await service.customerQuotePdf(params.id, actorFrom(req));
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${params.id}.pdf"`);
      return res.status(200).send(pdf);
    }),
  );

  router.get(
    '/anomalies',
    http.authenticatedRateLimit,
    ...read,
    http.asyncHandler(async (_req, res) => http.sendSuccess(res, await service.listAnomalies())),
  );

  router.post(
    '/anomalies/:id/disposition',
    http.authenticatedRateLimit,
    ...read,
    http.asyncHandler(async (req, res) => {
      const params = http.parseParams(anomalyParamSchema, req.params);
      const body = http.parseBody(anomalyDispositionBodySchema, req.body);
      return http.sendSuccess(res, await service.disposeAnomaly(params.id, body, actorFrom(req)));
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

  router.post(
    '/portal/:token/negotiations',
    http.publicRateLimit,
    http.asyncHandler(async (req, res) => {
      const params = http.parseParams(tokenParamSchema, req.params);
      const body = http.parseBody(portalNegotiationBodySchema, req.body);
      const quote = await service.createPortalNegotiation(params.token, body);
      return http.sendSuccess(res, toPortalView(quote as Parameters<typeof toPortalView>[0]), 201);
    }),
  );

  router.post(
    '/portal/:token/agree',
    http.publicRateLimit,
    http.asyncHandler(async (req, res) => {
      const params = http.parseParams(tokenParamSchema, req.params);
      const body = http.parseBody(expectedVersionSchema, req.body ?? {});
      const quote = await service.getQuoteByToken(params.token);
      const agreed = await service.agreeToFinal((quote as { id: string }).id, body, { id: 'portal', role: 'user' });
      return http.sendSuccess(res, toPortalView(agreed as Parameters<typeof toPortalView>[0]));
    }),
  );

  router.post(
    '/portal/:token/decision',
    http.publicRateLimit,
    http.asyncHandler(async (req, res) => {
      const params = http.parseParams(tokenParamSchema, req.params);
      const body = http.parseBody(portalDecisionBodySchema, req.body);
      return http.sendSuccess(res, await service.applyPortalDecision(params.token, body));
    }),
  );

  router.get(
    '/portal/:token/pdf',
    http.publicRateLimit,
    http.asyncHandler(async (req, res) => {
      const params = http.parseParams(tokenParamSchema, req.params);
      const pdf = await service.customerQuotePdfByToken(params.token);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="quotation.pdf"`);
      return res.status(200).send(pdf);
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
